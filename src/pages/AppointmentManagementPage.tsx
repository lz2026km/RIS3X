// @ts-nocheck
// 影像预约管理系统 - 患者影像检查预约管理
// 功能：预约列表、改约/取消、冲突检测、预约统计
import { useState, useMemo } from 'react'
import { replayOrderEvent } from '../utils/orderStateAdapter'
import {
  CalendarClock, ListOrdered, AlertTriangle, Search, Filter, RefreshCw,
  Plus, Edit2, XCircle, CheckCircle, Clock, X, ChevronLeft, ChevronRight,
  CalendarDays, User, Phone, CreditCard, Scan, MapPin, Bell,
  AlertCircle, Check, ArrowRightLeft, BarChart3, CalendarCheck
} from 'lucide-react'
import { formatDateObj } from '../utils/date';

// ==================== 类型定义 ====================
interface Appointment {
  id: string
  patientId: string
  patientName: string
  patientInitials: string
  gender: string
  age: number
  idCard: string
  phone: string
  examItemId: string
  examItemName: string
  modality: string
  bodyPart: string
  examDate: string
  examTime: string
  deviceId: string
  deviceName: string
  roomId: string
  roomName: string
  referringDoctorId: string
  referringDoctorName: string
  clinicalDiagnosis: string
  notes: string
  status: 'pending' | 'confirmed' | 'checked-in' | 'cancelled' | 'completed'
  priority: 'normal' | 'urgent' | 'critical'
  cancelReason?: string
  createdAt: string
  updatedAt: string
}

interface ConflictInfo {
  type: 'time' | 'device' | 'patient'
  message: string
  relatedAppointmentId?: string
}

interface Statistics {
  total: number
  pending: number
  confirmed: number
  checkedIn: number
  completed: number
  cancelled: number
  conflictCount: number
  todayTotal: number
  weekTotal: number
}

// ==================== 工具函数 ====================


const formatDateCht = (dateStr: string): string => {
  const d = new Date(dateStr)
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return `${d.getMonth() + 1}月${d.getDate()}日${weekdays[d.getDay()]}`
}

const getNameInitials = (name: string): string => {
  if (!name) return ''
  const parts = name.split(/[\s·]/)
  if (parts.length >= 2) return parts[0][0] + parts[1][0]
  return name.slice(0, 2)
}

const timeSlots = ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30']

// ==================== 样式常量 ====================
const COLORS = {
  primary: '#1e6fa9',
  primaryDark: '#17b98c',
  primaryLight: '#e8faf4',
  secondary: '#64748b',
  background: '#f8fafc',
  cardBackground: '#ffffff',
  text: '#1e293b',
  textSecondary: '#64748b',
  border: '#e2e8f0',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#3b82f6',
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string; border: string }> = {
  pending: { label: '待确认', bg: '#fef9c3', color: '#ca8a04', border: '#fef08a' },
  confirmed: { label: '已确认', bg: '#d1fae5', color: '#059669', border: '#6ee7b7' },
  'checked-in': { label: '已到检', bg: '#dbeafe', color: '#2563eb', border: '#93c5fd' },
  cancelled: { label: '已取消', bg: '#f1f5f9', color: '#64748b', border: '#cbd5e1' },
  completed: { label: '已完成', bg: '#d1fae5', color: '#059669', border: '#6ee7b7' },
}

const PRIORITY_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  critical: { label: '危重', bg: '#fee2e2', color: '#dc2626' },
  urgent: { label: '紧急', bg: '#fef3c7', color: '#d97706' },
  normal: { label: '普通', bg: '#f1f5f9', color: '#64748b' },
}

const MODALITY_OPTIONS = ['全部', 'CT', 'MR', 'DR', 'DSA', 'MG', 'GI', '超声', 'PET-CT']

// ==================== 模拟预约数据 ====================
const generateMockAppointments = (): Appointment[] => {
  const today = new Date()
  const base = formatDateObj(today)
  return [
    { id: 'IMG-001', patientId: 'P001', patientName: '张志刚', patientInitials: '张志', gender: '男', age: 62, idCard: '3101011964021XXXXX', phone: '13800138001', examItemId: 'EI-001', examItemName: '冠脉CTA', modality: 'CT', bodyPart: '心脏', examDate: base, examTime: '09:00', deviceId: 'DEV-CT-01', deviceName: 'CT-1（GE Revolution）', roomId: 'ROOM-CT1', roomName: 'CT室1', referringDoctorId: 'R001', referringDoctorName: '李明辉', clinicalDiagnosis: '冠心病待查', notes: '需控制心率', status: 'confirmed', priority: 'urgent', createdAt: '2026-04-28 10:00', updatedAt: '2026-04-28 10:00' },
    { id: 'IMG-002', patientId: 'P002', patientName: '李秀英', patientInitials: '李秀', gender: '女', age: 55, idCard: '3101021970021XXXXX', phone: '13800138002', examItemId: 'EI-002', examItemName: '头颅MR平扫', modality: 'MR', bodyPart: '头颅', examDate: base, examTime: '10:00', deviceId: 'DEV-MR-01', deviceName: 'MR-1（西门子Vida）', roomId: 'ROOM-MR1', roomName: 'MR室1', referringDoctorId: 'R002', referringDoctorName: '王秀峰', clinicalDiagnosis: '头痛待查', notes: '', status: 'pending', priority: 'normal', createdAt: '2026-04-29 08:00', updatedAt: '2026-04-29 08:00' },
    { id: 'IMG-003', patientId: 'P003', patientName: '王建国', patientInitials: '王建', gender: '男', age: 58, idCard: '3101031968011XXXXX', phone: '13800138003', examItemId: 'EI-003', examItemName: '胸部DR正侧位', modality: 'DR', bodyPart: '胸部', examDate: base, examTime: '09:30', deviceId: 'DEV-DR-01', deviceName: 'DR-1（飞利浦）', roomId: 'ROOM-DR1', roomName: 'DR室1', referringDoctorId: 'R003', referringDoctorName: '张海涛', clinicalDiagnosis: '健康体检', notes: '', status: 'checked-in', priority: 'normal', createdAt: '2026-04-27 14:00', updatedAt: '2026-04-30 07:30' },
    { id: 'IMG-004', patientId: 'P004', patientName: '赵晓敏', patientInitials: '赵晓', gender: '女', age: 45, idCard: '3101041978011XXXXX', phone: '13800138004', examItemId: 'EI-004', examItemName: '头颅CT平扫', modality: 'CT', bodyPart: '头颅', examDate: base, examTime: '11:00', deviceId: 'DEV-CT-01', deviceName: 'CT-1（GE Revolution）', roomId: 'ROOM-CT1', roomName: 'CT室1', referringDoctorId: 'R004', referringDoctorName: '刘芳', clinicalDiagnosis: '外伤后头晕', notes: '急诊绿色通道', status: 'confirmed', priority: 'critical', createdAt: '2026-05-01 06:00', updatedAt: '2026-05-01 06:00' },
    { id: 'IMG-005', patientId: 'P005', patientName: '周玉芬', patientInitials: '周玉', gender: '女', age: 52, idCard: '3101051973021XXXXX', phone: '13800138005', examItemId: 'EI-005', examItemName: '腹部CT平扫+增强', modality: 'CT', bodyPart: '腹部', examDate: base, examTime: '14:00', deviceId: 'DEV-CT-02', deviceName: 'CT-2（西门子Force）', roomId: 'ROOM-CT2', roomName: 'CT室2', referringDoctorId: 'R001', referringDoctorName: '李明辉', clinicalDiagnosis: '肝占位待查', notes: '空腹4h，增强需留置针', status: 'pending', priority: 'urgent', createdAt: '2026-04-30 09:00', updatedAt: '2026-04-30 09:00' },
    { id: 'IMG-006', patientId: 'P006', patientName: '孙伟', patientInitials: '孙伟', gender: '男', age: 35, idCard: '3101061990011XXXXX', phone: '13800138006', examItemId: 'EI-006', examItemName: '腰椎MR平扫', modality: 'MR', bodyPart: '脊柱', examDate: base, examTime: '15:00', deviceId: 'DEV-MR-01', deviceName: 'MR-1（西门子Vida）', roomId: 'ROOM-MR1', roomName: 'MR室1', referringDoctorId: 'R003', referringDoctorName: '张海涛', clinicalDiagnosis: '腰痛待查', notes: '', status: 'confirmed', priority: 'normal', createdAt: '2026-04-30 11:00', updatedAt: '2026-04-30 11:00' },
    { id: 'IMG-007', patientId: 'P007', patientName: '吴婷', patientInitials: '吴婷', gender: '女', age: 42, idCard: '3101071978021XXXXX', phone: '13800138007', examItemId: 'EI-007', examItemName: 'MG', modality: 'MG', bodyPart: '胸部', examDate: base, examTime: '10:00', deviceId: 'DEV-MG-01', deviceName: '乳腺钼靶（GE）', roomId: 'ROOM-MG1', roomName: '钼靶室1', referringDoctorId: 'R004', referringDoctorName: '刘芳', clinicalDiagnosis: '乳腺结节随访', notes: '月经结束后7-10天最佳', status: 'confirmed', priority: 'normal', createdAt: '2026-04-29 15:00', updatedAt: '2026-04-29 15:00' },
    { id: 'IMG-008', patientId: 'P008', patientName: '郑丽', patientInitials: '郑丽', gender: '女', age: 38, idCard: '3101081982021XXXXX', phone: '13800138008', examItemId: 'EI-008', examItemName: '腹部立卧位平片', modality: 'DR', bodyPart: '腹部', examDate: base, examTime: '08:00', deviceId: 'DEV-DR-02', deviceName: 'DR-2（GE）', roomId: 'ROOM-DR2', roomName: 'DR室2', referringDoctorId: 'R002', referringDoctorName: '王秀峰', clinicalDiagnosis: '肠梗阻待查', notes: '急查', status: 'completed', priority: 'urgent', createdAt: '2026-05-01 07:00', updatedAt: '2026-05-01 08:30' },
    { id: 'IMG-009', patientId: 'P001', patientName: '张志刚', patientInitials: '张志', gender: '男', age: 62, idCard: '3101011964021XXXXX', phone: '13800138001', examItemId: 'EI-009', examItemName: '冠脉造影', modality: 'DSA', bodyPart: '心脏', examDate: formatDateObj(new Date(today.getTime() + 86400000)), examTime: '08:30', deviceId: 'DEV-DSA-01', deviceName: 'DSA-1（飞利浦）', roomId: 'ROOM-DSA1', roomName: 'DSA室1', referringDoctorId: 'R001', referringDoctorName: '李明辉', clinicalDiagnosis: '冠心病三支病变', notes: '支架治疗前评估', status: 'confirmed', priority: 'urgent', createdAt: '2026-04-28 10:00', updatedAt: '2026-04-28 10:00' },
    { id: 'IMG-010', patientId: 'P002', patientName: '李秀英', patientInitials: '李秀', gender: '女', age: 55, idCard: '3101021970021XXXXX', phone: '13800138002', examItemId: 'EI-010', examItemName: '胸部CT平扫', modality: 'CT', bodyPart: '胸部', examDate: formatDateObj(new Date(today.getTime() + 86400000)), examTime: '09:30', deviceId: 'DEV-CT-01', deviceName: 'CT-1（GE Revolution）', roomId: 'ROOM-CT1', roomName: 'CT室1', referringDoctorId: 'R002', referringDoctorName: '王秀峰', clinicalDiagnosis: '肺炎复查', notes: '', status: 'pending', priority: 'normal', createdAt: '2026-04-30 16:00', updatedAt: '2026-04-30 16:00' },
    { id: 'IMG-011', patientId: 'P003', patientName: '王建国', patientInitials: '王建', gender: '男', age: 58, idCard: '3101031968011XXXXX', phone: '13800138003', examItemId: 'EI-011', examItemName: '脊柱CT', modality: 'CT', bodyPart: '脊柱', examDate: formatDateObj(new Date(today.getTime() + 86400000)), examTime: '14:00', deviceId: 'DEV-CT-02', deviceName: 'CT-2（西门子Force）', roomId: 'ROOM-CT2', roomName: 'CT室2', referringDoctorId: 'R003', referringDoctorName: '张海涛', clinicalDiagnosis: '腰椎间盘突出', notes: '', status: 'confirmed', priority: 'normal', createdAt: '2026-04-30 14:00', updatedAt: '2026-04-30 14:00' },
    { id: 'IMG-012', patientId: 'P004', patientName: '赵晓敏', patientInitials: '赵晓', gender: '女', age: 45, idCard: '3101041978011XXXXX', phone: '13800138004', examItemId: 'EI-012', examItemName: '腹部MR平扫+增强', modality: 'MR', bodyPart: '腹部', examDate: formatDateObj(new Date(today.getTime() + 86400000 * 2)), examTime: '10:00', deviceId: 'DEV-MR-01', deviceName: 'MR-1（西门子Vida）', roomId: 'ROOM-MR1', roomName: 'MR室1', referringDoctorId: 'R004', referringDoctorName: '刘芳', clinicalDiagnosis: '肝占位增强', notes: '空腹6h', status: 'pending', priority: 'urgent', createdAt: '2026-05-01 08:00', updatedAt: '2026-05-01 08:00' },
    { id: 'IMG-013', patientId: 'P005', patientName: '周玉芬', patientInitials: '周玉', gender: '女', age: 52, idCard: '3101051973021XXXXX', phone: '13800138005', examItemId: 'EI-013', examItemName: '上消化道造影', modality: 'GI', bodyPart: '腹部', examDate: formatDateObj(new Date(today.getTime() + 86400000)), examTime: '15:00', deviceId: 'DEV-RF-01', deviceName: '胃肠造影（岛津）', roomId: 'ROOM-RF1', roomName: '造影室1', referringDoctorId: 'R001', referringDoctorName: '李明辉', clinicalDiagnosis: '消化不良待查', notes: '', status: 'cancelled', priority: 'normal', cancelReason: 'patient', createdAt: '2026-04-29 10:00', updatedAt: '2026-05-01 09:00' },
    { id: 'IMG-014', patientId: 'P009', patientName: '钱伟明', patientInitials: '钱伟', gender: '男', age: 68, idCard: '3101091956011XXXXX', phone: '13800138009', examItemId: 'EI-014', examItemName: '胸部CT平扫', modality: 'CT', bodyPart: '胸部', examDate: formatDateObj(new Date(today.getTime() + 86400000)), examTime: '09:30', deviceId: 'DEV-CT-01', deviceName: 'CT-1（GE Revolution）', roomId: 'ROOM-CT1', roomName: 'CT室1', referringDoctorId: 'R002', referringDoctorName: '王秀峰', clinicalDiagnosis: '肺结节复查', notes: '高危结节', status: 'confirmed', priority: 'urgent', createdAt: '2026-05-02 09:00', updatedAt: '2026-05-02 09:00' },
    { id: 'IMG-015', patientId: 'P010', patientName: '陈丽华', patientInitials: '陈丽', gender: '女', age: 33, idCard: '3101101992011XXXXX', phone: '13800138010', examItemId: 'EI-015', examItemName: '甲状腺超声', modality: '超声', bodyPart: '颈部', examDate: base, examTime: '11:30', deviceId: 'DEV-US-01', deviceName: '超声-1（GE）', roomId: 'ROOM-US1', roomName: '超声室1', referringDoctorId: 'R004', referringDoctorName: '刘芳', clinicalDiagnosis: '甲状腺结节随访', notes: '', status: 'pending', priority: 'normal', createdAt: '2026-05-02 10:00', updatedAt: '2026-05-02 10:00' },
  ]
}

// ==================== 主组件 ====================
export default function AppointmentManagementPage() {
  const [appointments, setAppointments] = useState<Appointment[]>(generateMockAppointments())
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list')
  const [searchKeyword, setSearchKeyword] = useState('')
  const [filterModality, setFilterModality] = useState('全部')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterDate, setFilterDate] = useState('')
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date()
    const day = today.getDay()
    const monday = new Date(today)
    monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1))
    return monday
  })

  // 弹窗状态
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showRescheduleModal, setShowRescheduleModal] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [showConflictModal, setShowConflictModal] = useState(false)
  const [conflictDetails, setConflictDetails] = useState<ConflictInfo[]>([])
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [rescheduleData, setRescheduleData] = useState({ examDate: '', examTime: '', deviceId: '' })

  // 统计信息
  const statistics: Statistics = useMemo(() => {
    const today = formatDateObj(new Date())
    const weekEnd = new Date(currentWeekStart)
    weekEnd.setDate(currentWeekStart.getDate() + 6)
    const weekEndStr = formatDateObj(weekEnd)

    const todayAppts = appointments.filter(a => a.examDate === today)
    const weekAppts = appointments.filter(a => a.examDate >= formatDateObj(currentWeekStart) && a.examDate <= weekEndStr)

    // 检测冲突（同一患者同一时段多个预约）
    const conflicts: Set<string> = new Set()
    appointments.forEach(apt => {
      const conflict = appointments.find(other =>
        other.id !== apt.id &&
        other.patientId === apt.patientId &&
        other.examDate === apt.examDate &&
        other.examTime === apt.examTime &&
        other.status !== 'cancelled' &&
        other.status !== 'completed'
      )
      if (conflict) {
        conflicts.add(apt.id)
        conflicts.add(conflict.id)
      }
    })

    return {
      total: appointments.length,
      pending: appointments.filter(a => a.status === 'pending').length,
      confirmed: appointments.filter(a => a.status === 'confirmed').length,
      checkedIn: appointments.filter(a => a.status === 'checked-in').length,
      completed: appointments.filter(a => a.status === 'completed').length,
      cancelled: appointments.filter(a => a.status === 'cancelled').length,
      conflictCount: conflicts.size / 2,
      todayTotal: todayAppts.length,
      weekTotal: weekAppts.length,
    }
  }, [appointments, currentWeekStart])

  // 过滤预约列表
  const filteredAppointments = useMemo(() => {
    let list = [...appointments].sort((a, b) => {
      const dateCompare = a.examDate.localeCompare(b.examDate)
      if (dateCompare !== 0) return dateCompare
      return a.examTime.localeCompare(b.examTime)
    })

    if (searchKeyword) {
      const kw = searchKeyword.toLowerCase()
      list = list.filter(a =>
        a.patientName.toLowerCase().includes(kw) ||
        a.id.toLowerCase().includes(kw) ||
        a.phone.includes(kw) ||
        a.examItemName.toLowerCase().includes(kw)
      )
    }

    if (filterModality !== '全部') {
      list = list.filter(a => a.modality === filterModality)
    }

    if (filterStatus !== 'all') {
      list = list.filter(a => a.status === filterStatus)
    }

    if (filterDate) {
      list = list.filter(a => a.examDate === filterDate)
    }

    return list
  }, [appointments, searchKeyword, filterModality, filterStatus, filterDate])

  // 冲突检测
  const checkConflicts = (apt: Appointment): ConflictInfo[] => {
    const conflicts: ConflictInfo[] = []

    // 检查同一设备同时段
    const deviceConflict = appointments.find(other =>
      other.id !== apt.id &&
      other.deviceId === apt.deviceId &&
      other.examDate === apt.examDate &&
      other.examTime === apt.examTime &&
      other.status !== 'cancelled' &&
      other.status !== 'completed'
    )
    if (deviceConflict) {
      conflicts.push({
        type: 'device',
        message: `设备冲突：${deviceConflict.deviceName} 在 ${apt.examTime} 已有预约（${deviceConflict.patientName}）`,
        relatedAppointmentId: deviceConflict.id
      })
    }

    // 检查同一患者同时段
    const patientConflict = appointments.find(other =>
      other.id !== apt.id &&
      other.patientId === apt.patientId &&
      other.examDate === apt.examDate &&
      other.examTime === apt.examTime &&
      other.status !== 'cancelled' &&
      other.status !== 'completed'
    )
    if (patientConflict) {
      conflicts.push({
        type: 'patient',
        message: `患者时间冲突：${patientConflict.patientName} 在此时段已有其他检查预约`,
        relatedAppointmentId: patientConflict.id
      })
    }

    return conflicts
  }

  // 改约操作
  const handleReschedule = () => {
    if (!selectedAppointment || !rescheduleData.examDate || !rescheduleData.examTime) return

    const updatedApt: Appointment = {
      ...selectedAppointment,
      examDate: rescheduleData.examDate,
      examTime: rescheduleData.examTime,
      updatedAt: new Date().toLocaleString('zh-CN')
    }

    const conflicts = checkConflicts(updatedApt)
    if (conflicts.length > 0) {
      setConflictDetails(conflicts)
      setShowConflictModal(true)
      return
    }

    setAppointments(prev => prev.map(a => a.id === selectedAppointment.id ? updatedApt : a))
    setShowRescheduleModal(false)
    setSelectedAppointment(null)
    setRescheduleData({ examDate: '', examTime: '', deviceId: '' })
  }

  // 取消操作
  const handleCancel = () => {
    if (!selectedAppointment || !cancelReason) return

    // orderMachine: approved/scheduled/confirmed → cancelled via CANCEL (with reason)
    replayOrderEvent(selectedAppointment.status, { type: 'CANCEL', reason: cancelReason, by: 'system' })

    setAppointments(prev => prev.map(a =>
      a.id === selectedAppointment.id
        ? { ...a, status: 'cancelled' as const, cancelReason, updatedAt: new Date().toLocaleString('zh-CN') }
        : a
    ))
    setShowCancelModal(false)
    setSelectedAppointment(null)
    setCancelReason('')
  }

  // 打开改约弹窗
  const openRescheduleModal = (apt: Appointment) => {
    setSelectedAppointment(apt)
    setRescheduleData({
      examDate: apt.examDate,
      examTime: apt.examTime,
      deviceId: apt.deviceId
    })
    setShowRescheduleModal(true)
  }

  // 获取周日期
  const getWeekDates = () => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(currentWeekStart)
      d.setDate(currentWeekStart.getDate() + i)
      return d
    })
  }

  const weekDates = getWeekDates()

  // 样式定义
  const styles = {
    container: {
      minHeight: '100vh',
      backgroundColor: COLORS.background,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    },
    header: {
      background: `linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.primaryDark} 100%)`,
      color: 'white',
      padding: '24px 32px',
      boxShadow: '0 4px 12px rgba(30, 111, 175, 0.3)',
    },
    headerTitle: {
      fontSize: '24px',
      fontWeight: '600',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      marginBottom: '8px',
    },
    headerSubtitle: {
      fontSize: '14px',
      opacity: 0.9,
    },
    main: {
      padding: '24px 32px',
      maxWidth: '1600px',
      margin: '0 auto',
    },
    statsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
      gap: '16px',
      marginBottom: '24px',
    },
    statCard: {
      backgroundColor: COLORS.cardBackground,
      borderRadius: '12px',
      padding: '20px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      border: `1px solid ${COLORS.border}`,
    },
    statLabel: {
      fontSize: '13px',
      color: COLORS.textSecondary,
      marginBottom: '8px',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
    },
    statValue: {
      fontSize: '28px',
      fontWeight: '700',
      color: COLORS.text,
    },
    statChange: {
      fontSize: '12px',
      marginTop: '4px',
    },
    toolbar: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '20px',
      flexWrap: 'wrap',
      gap: '12px',
    },
    toolbarLeft: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      flexWrap: 'wrap',
    },
    toolbarRight: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
    },
    searchBox: {
      display: 'flex',
      alignItems: 'center',
      backgroundColor: COLORS.cardBackground,
      border: `1px solid ${COLORS.border}`,
      borderRadius: '8px',
      padding: '8px 12px',
      gap: '8px',
      minWidth: '280px',
    },
    searchInput: {
      border: 'none',
      outline: 'none',
      fontSize: '14px',
      flex: 1,
      backgroundColor: 'transparent',
    },
    select: {
      padding: '8px 12px',
      borderRadius: '8px',
      border: `1px solid ${COLORS.border}`,
      backgroundColor: COLORS.cardBackground,
      fontSize: '14px',
      cursor: 'pointer',
      outline: 'none',
    },
    viewToggle: {
      display: 'flex',
      backgroundColor: COLORS.cardBackground,
      borderRadius: '8px',
      padding: '4px',
      border: `1px solid ${COLORS.border}`,
    },
    viewBtn: (active: boolean) => ({
      padding: '8px 16px',
      borderRadius: '6px',
      border: 'none',
      cursor: 'pointer',
      fontSize: '14px',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      backgroundColor: active ? COLORS.primary : 'transparent',
      color: active ? 'white' : COLORS.textSecondary,
      transition: 'all 0.2s',
    }),
    table: {
      width: '100%',
      backgroundColor: COLORS.cardBackground,
      borderRadius: '12px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      border: `1px solid ${COLORS.border}`,
      overflow: 'hidden',
    },
    tableHeader: {
      display: 'grid',
      gridTemplateColumns: '120px 100px 100px 120px 100px 80px 100px 120px',
      padding: '14px 20px',
      backgroundColor: '#f8fafc',
      borderBottom: `1px solid ${COLORS.border}`,
      fontSize: '13px',
      fontWeight: '600',
      color: COLORS.textSecondary,
    },
    tableRow: {
      display: 'grid',
      gridTemplateColumns: '120px 100px 100px 120px 100px 80px 100px 120px',
      padding: '14px 20px',
      borderBottom: `1px solid ${COLORS.border}`,
      alignItems: 'center',
      fontSize: '14px',
      transition: 'background-color 0.15s',
    },
    badge: (bg: string, color: string) => ({
      display: 'inline-flex',
      alignItems: 'center',
      padding: '4px 10px',
      borderRadius: '20px',
      fontSize: '12px',
      fontWeight: '500',
      backgroundColor: bg,
      color: color,
    }),
    priorityDot: (color: string) => ({
      width: '8px',
      height: '8px',
      borderRadius: '50%',
      backgroundColor: color,
      marginRight: '6px',
    }),
    actionBtn: (variant: 'primary' | 'secondary' | 'danger') => {
      const configs = {
        primary: { bg: COLORS.primary, color: 'white' },
        secondary: { bg: 'transparent', color: COLORS.textSecondary, border: COLORS.border },
        danger: { bg: COLORS.danger, color: 'white' },
      }
      const config = configs[variant]
      return {
        padding: '6px 12px',
        borderRadius: '6px',
        border: variant === 'secondary' ? `1px solid ${COLORS.border}` : 'none',
        cursor: 'pointer',
        fontSize: '13px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        backgroundColor: config.bg,
        color: config.color,
      }
    },
    modal: {
      position: 'fixed' as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    },
    modalContent: {
      backgroundColor: COLORS.cardBackground,
      borderRadius: '16px',
      padding: '24px',
      maxWidth: '600px',
      width: '90%',
      maxHeight: '90vh',
      overflow: 'auto',
      boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
    },
    modalHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '20px',
      paddingBottom: '16px',
      borderBottom: `1px solid ${COLORS.border}`,
    },
    modalTitle: {
      fontSize: '18px',
      fontWeight: '600',
      color: COLORS.text,
    },
    formGroup: {
      marginBottom: '16px',
    },
    formLabel: {
      display: 'block',
      fontSize: '13px',
      fontWeight: '500',
      color: COLORS.textSecondary,
      marginBottom: '6px',
    },
    formInput: {
      width: '100%',
      padding: '10px 12px',
      borderRadius: '8px',
      border: `1px solid ${COLORS.border}`,
      fontSize: '14px',
      outline: 'none',
      boxSizing: 'border-box' as const,
    },
    formRow: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '12px',
    },
    calendar: {
      backgroundColor: COLORS.cardBackground,
      borderRadius: '12px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      border: `1px solid ${COLORS.border}`,
      overflow: 'hidden',
    },
    calendarHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '16px 20px',
      borderBottom: `1px solid ${COLORS.border}`,
    },
    calendarGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(7, 1fr)',
    },
    calendarDayHeader: {
      padding: '12px',
      textAlign: 'center' as const,
      fontSize: '12px',
      fontWeight: '600',
      color: COLORS.textSecondary,
      backgroundColor: '#f8fafc',
      borderBottom: `1px solid ${COLORS.border}`,
    },
    calendarDay: {
      minHeight: '100px',
      padding: '8px',
      borderRight: `1px solid ${COLORS.border}`,
      borderBottom: `1px solid ${COLORS.border}`,
    },
    conflictAlert: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: '12px',
      padding: '12px 16px',
      backgroundColor: '#fef2f2',
      border: '1px solid #fecaca',
      borderRadius: '8px',
      marginBottom: '16px',
    },
  }

  return (
    <div style={styles.container}>
      {/* 头部 */}
      <div style={styles.header}>
        <div style={styles.headerTitle}>
          <CalendarClock size={28} />
          影像预约管理
        </div>
        <div style={styles.headerSubtitle}>患者影像检查预约管理 · 预约列表 · 改约/取消 · 冲突检测 · 预约统计</div>
      </div>

      <div style={styles.main}>
        {/* 统计卡片 */}
        <div style={styles.statsGrid}>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>
              <CalendarClock size={16} color={COLORS.primary} />
              今日预约
            </div>
            <div style={styles.statValue}>{statistics.todayTotal}</div>
            <div style={{ ...styles.statChange, color: COLORS.primary }}>本周 {statistics.weekTotal} 例</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>
              <Clock size={16} color={COLORS.warning} />
              待确认
            </div>
            <div style={styles.statValue}>{statistics.pending}</div>
            <div style={{ ...styles.statChange, color: COLORS.warning }}>待处理</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>
              <CheckCircle size={16} color={COLORS.success} />
              已确认
            </div>
            <div style={{...styles.statValue, color: COLORS.success}}>{statistics.confirmed}</div>
            <div style={{ ...styles.statChange, color: COLORS.success }}>已确认</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>
              <AlertTriangle size={16} color={COLORS.danger} />
              冲突检测
            </div>
            <div style={{...styles.statValue, color: statistics.conflictCount > 0 ? COLORS.danger : COLORS.success}}>
              {statistics.conflictCount}
            </div>
            <div style={{ ...styles.statChange, color: COLORS.textSecondary }}>
              {statistics.conflictCount > 0 ? '存在冲突' : '无冲突'}
            </div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>
              <BarChart3 size={16} color={COLORS.info} />
              本周总计
            </div>
            <div style={styles.statValue}>{statistics.weekTotal}</div>
            <div style={{ ...styles.statChange, color: COLORS.textSecondary }}>全部状态</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>
              <CheckCircle size={16} color={COLORS.success} />
              已完成
            </div>
            <div style={styles.statValue}>{statistics.completed}</div>
            <div style={{ ...styles.statChange, color: COLORS.textSecondary }}>累计完成</div>
          </div>
        </div>

        {/* 工具栏 */}
        <div style={styles.toolbar}>
          <div style={styles.toolbarLeft}>
            <div style={styles.searchBox}>
              <Search size={18} color={COLORS.textSecondary} />
              <input
                type="text"
                placeholder="搜索患者姓名/预约ID/电话/检查项目..."
                style={styles.searchInput}
                value={searchKeyword}
                onChange={e => setSearchKeyword(e.target.value)}
              />
              {searchKeyword && (
                <X size={16} color={COLORS.textSecondary} style={{ cursor: 'pointer' }} onClick={() => setSearchKeyword('')} />
              )}
            </div>
            <select style={styles.select} value={filterModality} onChange={e => setFilterModality(e.target.value)}>
              {MODALITY_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <select style={styles.select} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="all">全部状态</option>
              <option value="pending">待确认</option>
              <option value="confirmed">已确认</option>
              <option value="checked-in">已到检</option>
              <option value="completed">已完成</option>
              <option value="cancelled">已取消</option>
            </select>
            <input
              type="date"
              style={styles.select}
              value={filterDate}
              onChange={e => setFilterDate(e.target.value)}
            />
            {(filterModality !== '全部' || filterStatus !== 'all' || filterDate) && (
              <button
                style={{ ...styles.actionBtn('secondary'), display: 'flex', alignItems: 'center', gap: '4px' }}
                onClick={() => { setFilterModality('全部'); setFilterStatus('all'); setFilterDate('') }}
              >
                <X size={14} /> 清空筛选
              </button>
            )}
          </div>
          <div style={styles.toolbarRight}>
            <div style={styles.viewToggle}>
              <button
                style={styles.viewBtn(viewMode === 'list')}
                onClick={() => setViewMode('list')}
              >
                <ListOrdered size={16} /> 列表
              </button>
              <button
                style={styles.viewBtn(viewMode === 'calendar')}
                onClick={() => setViewMode('calendar')}
              >
                <CalendarDays size={16} /> 日历
              </button>
            </div>
            <button style={{ ...styles.actionBtn('primary'), display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Plus size={16} /> 新建预约
            </button>
          </div>
        </div>

        {/* 列表视图 */}
        {viewMode === 'list' && (
          <div style={styles.table}>
            <div style={styles.tableHeader}>
              <div>预约ID</div>
              <div>患者信息</div>
              <div>检查项目</div>
              <div>检查部位</div>
              <div>预约时间</div>
              <div>状态</div>
              <div>优先级</div>
              <div>操作</div>
            </div>
            {filteredAppointments.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: COLORS.textSecondary }}>
                <CalendarClock size={48} style={{ marginBottom: '12px', opacity: 0.5 }} />
                <div>暂无预约数据</div>
              </div>
            ) : (
              filteredAppointments.map((apt, idx) => {
                const statusCfg = STATUS_CONFIG[apt.status] || STATUS_CONFIG.pending
                const priorityCfg = PRIORITY_CONFIG[apt.priority] || PRIORITY_CONFIG.normal
                const conflicts = checkConflicts(apt)
                const hasConflict = conflicts.length > 0

                return (
                  <div
                    key={apt.id}
                    style={{
                      ...styles.tableRow,
                      backgroundColor: idx % 2 === 0 ? 'white' : '#fafafa',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = COLORS.primaryLight)}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = idx % 2 === 0 ? 'white' : '#fafafa')}
                  >
                    <div style={{ fontWeight: '500', color: COLORS.primary }}>{apt.id}</div>
                    <div>
                      <div style={{ fontWeight: '500' }}>{apt.patientName}</div>
                      <div style={{ fontSize: '12px', color: COLORS.textSecondary }}>{apt.gender}/{apt.age}岁</div>
                    </div>
                    <div>
                      <div>{apt.examItemName}</div>
                      <div style={{ fontSize: '12px', color: COLORS.textSecondary }}>{apt.modality}</div>
                    </div>
                    <div>{apt.bodyPart}</div>
                    <div>
                      <div>{apt.examDate}</div>
                      <div style={{ fontSize: '12px', color: COLORS.textSecondary }}>{apt.examTime}</div>
                    </div>
                    <div>
                      <span style={styles.badge(statusCfg.bg, statusCfg.color)}>
                        {hasConflict && <AlertTriangle size={12} style={{ marginRight: '4px' }} />}
                        {statusCfg.label}
                      </span>
                    </div>
                    <div>
                      <span style={{ display: 'flex', alignItems: 'center' }}>
                        <span style={styles.priorityDot(priorityCfg.color)} />
                        {priorityCfg.label}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        style={styles.actionBtn('secondary')}
                        onClick={() => { setSelectedAppointment(apt); setShowDetailModal(true) }}
                        title="查看详情"
                      >
                        <CalendarCheck size={14} />
                      </button>
                      {apt.status !== 'cancelled' && apt.status !== 'completed' && (
                        <>
                          <button
                            style={styles.actionBtn('primary')}
                            onClick={() => openRescheduleModal(apt)}
                            title="改约"
                          >
                            <ArrowRightLeft size={14} />
                          </button>
                          <button
                            style={styles.actionBtn('danger')}
                            onClick={() => { setSelectedAppointment(apt); setShowCancelModal(true) }}
                            title="取消预约"
                          >
                            <XCircle size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* 日历视图 */}
        {viewMode === 'calendar' && (
          <div style={styles.calendar}>
            <div style={styles.calendarHeader}>
              <button
                style={{ ...styles.actionBtn('secondary'), display: 'flex', alignItems: 'center', gap: '4px' }}
                onClick={() => {
                  const newStart = new Date(currentWeekStart)
                  newStart.setDate(currentWeekStart.getDate() - 7)
                  setCurrentWeekStart(newStart)
                }}
              >
                <ChevronLeft size={16} /> 上周
              </button>
              <div style={{ fontSize: '16px', fontWeight: '600' }}>
                {currentWeekStart.getMonth() + 1}月 {currentWeekStart.getDate()}日 - {' '}
                {weekDates[6].getMonth() + 1}月 {weekDates[6].getDate()}日
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  style={{ ...styles.actionBtn('secondary'), display: 'flex', alignItems: 'center', gap: '4px' }}
                  onClick={() => setCurrentWeekStart(new Date())}
                >
                  今天
                </button>
                <button
                  style={{ ...styles.actionBtn('secondary'), display: 'flex', alignItems: 'center', gap: '4px' }}
                  onClick={() => {
                    const newStart = new Date(currentWeekStart)
                    newStart.setDate(currentWeekStart.getDate() + 7)
                    setCurrentWeekStart(newStart)
                  }}
                >
                  下周 <ChevronRight size={16} />
                </button>
              </div>
            </div>
            <div style={styles.calendarGrid}>
              {['周一', '周二', '周三', '周四', '周五', '周六', '周日'].map(day => (
                <div key={day} style={styles.calendarDayHeader}>{day}</div>
              ))}
              {weekDates.map((date, idx) => {
                const dateStr = formatDateObj(date)
                const dayAppts = appointments.filter(a => a.examDate === dateStr)
                const isToday = dateStr === formatDateObj(new Date())

                return (
                  <div
                    key={idx}
                    style={{
                      ...styles.calendarDay,
                      backgroundColor: isToday ? COLORS.primaryLight : 'white',
                    }}
                  >
                    <div style={{
                      fontSize: '14px',
                      fontWeight: '600',
                      marginBottom: '8px',
                      color: isToday ? COLORS.primary : COLORS.text,
                    }}>
                      {date.getDate()}
                    </div>
                    {dayAppts.slice(0, 3).map(apt => (
                      <div
                        key={apt.id}
                        style={{
                          ...styles.badge(
                            STATUS_CONFIG[apt.status]?.bg || '#f1f5f9',
                            STATUS_CONFIG[apt.status]?.color || '#64748b'
                          ),
                          fontSize: '11px',
                          marginBottom: '4px',
                          cursor: 'pointer',
                          justifyContent: 'center',
                        }}
                        onClick={() => { setSelectedAppointment(apt); setShowDetailModal(true) }}
                      >
                        {apt.examTime} {apt.patientName}
                      </div>
                    ))}
                    {dayAppts.length > 3 && (
                      <div style={{ fontSize: '11px', color: COLORS.textSecondary, textAlign: 'center' }}>
                        +{dayAppts.length - 3} 更多
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* 详情弹窗 */}
      {showDetailModal && selectedAppointment && (
        <div style={styles.modal} onClick={() => setShowDetailModal(false)}>
          <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div style={styles.modalTitle}>预约详情</div>
              <X size={20} style={{ cursor: 'pointer' }} onClick={() => setShowDetailModal(false)} />
            </div>

            {/* 冲突提示 */}
            {checkConflicts(selectedAppointment).length > 0 && (
              <div style={styles.conflictAlert}>
                <AlertTriangle size={20} color={COLORS.danger} />
                <div>
                  <div style={{ fontWeight: '600', color: COLORS.danger, marginBottom: '4px' }}>存在冲突</div>
                  {checkConflicts(selectedAppointment).map((c, i) => (
                    <div key={i} style={{ fontSize: '13px', color: COLORS.text }}>{c.message}</div>
                  ))}
                </div>
              </div>
            )}

            <div style={styles.formRow}>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>预约ID</label>
                <div style={{ padding: '10px', backgroundColor: '#f8fafc', borderRadius: '8px', fontWeight: '500', color: COLORS.primary }}>
                  {selectedAppointment.id}
                </div>
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>状态</label>
                <div style={{ padding: '10px', backgroundColor: STATUS_CONFIG[selectedAppointment.status]?.bg }}>
                  <span style={styles.badge(
                    STATUS_CONFIG[selectedAppointment.status]?.bg,
                    STATUS_CONFIG[selectedAppointment.status]?.color
                  )}>
                    {STATUS_CONFIG[selectedAppointment.status]?.label}
                  </span>
                </div>
              </div>
            </div>

            <div style={styles.formRow}>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>患者姓名</label>
                <div style={{ padding: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <User size={16} color={COLORS.textSecondary} />
                  {selectedAppointment.patientName}
                </div>
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>患者信息</label>
                <div style={{ padding: '10px', fontSize: '13px', color: COLORS.textSecondary }}>
                  {selectedAppointment.gender} / {selectedAppointment.age}岁 / {selectedAppointment.idCard}
                </div>
              </div>
            </div>

            <div style={styles.formRow}>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>联系电话</label>
                <div style={{ padding: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Phone size={16} color={COLORS.textSecondary} />
                  {selectedAppointment.phone}
                </div>
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>优先级</label>
                <div style={{ padding: '10px' }}>
                  <span style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={styles.priorityDot(PRIORITY_CONFIG[selectedAppointment.priority]?.color)} />
                    {PRIORITY_CONFIG[selectedAppointment.priority]?.label}
                  </span>
                </div>
              </div>
            </div>

            <div style={styles.formRow}>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>检查项目</label>
                <div style={{ padding: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Scan size={16} color={COLORS.textSecondary} />
                  {selectedAppointment.examItemName}
                </div>
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>检查部位</label>
                <div style={{ padding: '10px' }}>
                  {selectedAppointment.bodyPart}（{selectedAppointment.modality}）
                </div>
              </div>
            </div>

            <div style={styles.formRow}>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>预约日期</label>
                <div style={{ padding: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CalendarClock size={16} color={COLORS.textSecondary} />
                  {formatDateCht(selectedAppointment.examDate)}
                </div>
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>预约时间</label>
                <div style={{ padding: '10px' }}>{selectedAppointment.examTime}</div>
              </div>
            </div>

            <div style={styles.formRow}>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>检查设备</label>
                <div style={{ padding: '10px', fontSize: '13px' }}>{selectedAppointment.deviceName}</div>
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>检查地点</label>
                <div style={{ padding: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <MapPin size={16} color={COLORS.textSecondary} />
                  {selectedAppointment.roomName}
                </div>
              </div>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.formLabel}>临床诊断</label>
              <div style={{ padding: '10px', backgroundColor: '#f8fafc', borderRadius: '8px', fontSize: '13px' }}>
                {selectedAppointment.clinicalDiagnosis}
              </div>
            </div>

            {selectedAppointment.notes && (
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>备注</label>
                <div style={{ padding: '10px', backgroundColor: '#fef9c3', borderRadius: '8px', fontSize: '13px' }}>
                  {selectedAppointment.notes}
                </div>
              </div>
            )}

            {selectedAppointment.cancelReason && (
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>取消原因</label>
                <div style={{ padding: '10px', backgroundColor: '#fee2e2', borderRadius: '8px', fontSize: '13px', color: COLORS.danger }}>
                  {selectedAppointment.cancelReason === 'patient' ? '患者主动取消' :
                   selectedAppointment.cancelReason === 'device' ? '设备故障' :
                   selectedAppointment.cancelReason === 'doctor' ? '医生取消' :
                   selectedAppointment.cancelReason === 'reschedule' ? '改期' : '其他'}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
              {selectedAppointment.status !== 'cancelled' && selectedAppointment.status !== 'completed' && (
                <>
                  <button
                    style={styles.actionBtn('secondary')}
                    onClick={() => { setShowDetailModal(false); openRescheduleModal(selectedAppointment) }}
                  >
                    <ArrowRightLeft size={14} /> 改约
                  </button>
                  <button
                    style={styles.actionBtn('danger')}
                    onClick={() => { setShowDetailModal(false); setShowCancelModal(true) }}
                  >
                    <XCircle size={14} /> 取消预约
                  </button>
                </>
              )}
              <button
                style={styles.actionBtn('secondary')}
                onClick={() => setShowDetailModal(false)}
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 改约弹窗 */}
      {showRescheduleModal && selectedAppointment && (
        <div style={styles.modal} onClick={() => setShowRescheduleModal(false)}>
          <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div style={styles.modalTitle}>改约预约</div>
              <X size={20} style={{ cursor: 'pointer' }} onClick={() => setShowRescheduleModal(false)} />
            </div>

            <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: COLORS.primaryLight, borderRadius: '8px' }}>
              <div style={{ fontSize: '13px', color: COLORS.textSecondary }}>当前预约</div>
              <div style={{ fontWeight: '500', marginTop: '4px' }}>
                {selectedAppointment.patientName} - {selectedAppointment.examItemName}
              </div>
              <div style={{ fontSize: '13px', color: COLORS.textSecondary, marginTop: '4px' }}>
                {selectedAppointment.examDate} {selectedAppointment.examTime} @ {selectedAppointment.deviceName}
              </div>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.formLabel}>新预约日期 *</label>
              <input
                type="date"
                style={styles.formInput}
                value={rescheduleData.examDate}
                onChange={e => setRescheduleData({ ...rescheduleData, examDate: e.target.value })}
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.formLabel}>新预约时间 *</label>
              <select
                style={styles.formInput}
                value={rescheduleData.examTime}
                onChange={e => setRescheduleData({ ...rescheduleData, examTime: e.target.value })}
              >
                <option value="">请选择时间</option>
                {timeSlots.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            {/* 改约后冲突检测预览 */}
            {rescheduleData.examDate && rescheduleData.examTime && (
              <div style={styles.conflictAlert}>
                <AlertTriangle size={20} color={COLORS.warning} />
                <div style={{ fontSize: '13px' }}>
                  改约后将检测与现有预约的冲突，请确认新时间段的可用性。
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
              <button
                style={styles.actionBtn('secondary')}
                onClick={() => setShowRescheduleModal(false)}
              >
                取消
              </button>
              <button
                style={styles.actionBtn('primary')}
                onClick={handleReschedule}
                disabled={!rescheduleData.examDate || !rescheduleData.examTime}
              >
                <Check size={14} /> 确认改约
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 冲突详情弹窗 */}
      {showConflictModal && conflictDetails.length > 0 && (
        <div style={styles.modal} onClick={() => setShowConflictModal(false)}>
          <div style={{ ...styles.modalContent, maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <div style={{ ...styles.modalHeader, backgroundColor: COLORS.warning }}>
              <div style={styles.modalTitle}>预约冲突</div>
              <X size={20} style={{ cursor: 'pointer' }} onClick={() => setShowConflictModal(false)} />
            </div>
            <div style={{ padding: '16px' }}>
              <div style={{ marginBottom: '12px', padding: '12px', backgroundColor: '#fef3c7', borderRadius: '8px', border: `1px solid ${COLORS.warning}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <AlertTriangle size={18} color={COLORS.warning} />
                  <span style={{ fontWeight: 600, color: COLORS.warning }}>检测到 {conflictDetails.length} 个冲突</span>
                </div>
                <div style={{ fontSize: 13, color: COLORS.textDark }}>
                  改约后的时间与现有预约存在冲突，请选择其他时间段。
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {conflictDetails.map((conflict, index) => (
                  <div key={index} style={{ padding: '10px 12px', backgroundColor: '#fff', borderRadius: 6, border: `1px solid ${COLORS.border}`, fontSize: 13 }}>
                    <div style={{ fontWeight: 500, marginBottom: 4 }}>{conflict.message}</div>
                    {conflict.relatedAppointmentId && (
                      <div style={{ fontSize: 12, color: COLORS.textMuted }}>相关预约ID: {conflict.relatedAppointmentId}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 16px', borderTop: `1px solid ${COLORS.border}` }}>
              <button
                style={{ ...styles.actionBtn('primary') }}
                onClick={() => setShowConflictModal(false)}
              >
                知道了
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 取消确认弹窗 */}
      {showCancelModal && selectedAppointment && (
        <div style={styles.modal} onClick={() => setShowCancelModal(false)}>
          <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div style={styles.modalTitle}>取消预约</div>
              <X size={20} style={{ cursor: 'pointer' }} onClick={() => setShowCancelModal(false)} />
            </div>

            <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: '#fee2e2', borderRadius: '8px' }}>
              <div style={{ fontWeight: '500', color: COLORS.danger }}>
                {selectedAppointment.patientName} - {selectedAppointment.examItemName}
              </div>
              <div style={{ fontSize: '13px', color: COLORS.textSecondary, marginTop: '4px' }}>
                {selectedAppointment.examDate} {selectedAppointment.examTime}
              </div>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.formLabel}>取消原因 *</label>
              <select
                style={styles.formInput}
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
              >
                <option value="">请选择取消原因</option>
                <option value="patient">患者主动取消</option>
                <option value="device">设备故障</option>
                <option value="doctor">医生取消</option>
                <option value="reschedule">改期</option>
                <option value="other">其他</option>
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
              <button
                style={styles.actionBtn('secondary')}
                onClick={() => setShowCancelModal(false)}
              >
                返回
              </button>
              <button
                style={styles.actionBtn('danger')}
                onClick={handleCancel}
                disabled={!cancelReason}
              >
                <XCircle size={14} /> 确认取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
