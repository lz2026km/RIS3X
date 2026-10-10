// @deprecated [v3.0.6.11-103 Wave 10] 重复页面精简合并: 本页已嵌入 AppointmentPage "预约管理" 视图 (src/pages/AppointmentPage.tsx), 文件保留, 旧路由 /appointment-management 已 redirect → /appointments。功能未删除, 请勿单独继续扩展本页。
// 影像预约管理系统 - 患者影像检查预约管理
// 功能：预约列表、改约/取消、冲突检测、预约统计
import { useState, useMemo, useCallback, useEffect } from 'react'
import { replayOrderEvent } from '../utils/orderStateAdapter'
import { uniqueId } from '../utils/uniqueId'
import {
  CalendarClock, ListOrdered, AlertTriangle, Search,
  Plus, XCircle, CheckCircle, Clock, X, ChevronLeft, ChevronRight,
  CalendarDays, User, Phone, Scan, MapPin,
  Check, ArrowRightLeft, BarChart3, CalendarCheck, ScanLine, History
} from 'lucide-react'
// [G005 W4B] 检查号解析 + 改期历史类型
import type { AccessionParseResultDto, RescheduleRecordDto } from '../services/api/appointmentApi'
import { formatDateObj } from '../utils/date';
import { t } from '../i18n/appI18n';

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
  if (parts.length >= 2) return (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')
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
  background: 'var(--bg-card)',
  cardBackground: 'var(--bg-card)',
  text: '#1e293b',
  textSecondary: '#64748b',
  border: 'var(--border-color)',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#3b82f6',
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string; border: string }> = {
  pending: { label: '待确认', bg: '#f59e0b22', color: '#ca8a04', border: '#fef08a' },
  confirmed: { label: '已确认', bg: '#22c55e22', color: '#059669', border: '#6ee7b7' },
  'checked-in': { label: '已到检', bg: '#3b82f622', color: '#3b82f6', border: '#93c5fd' },
  cancelled: { label: '已取消', bg: 'var(--bg-deep)', color: 'var(--text-secondary)', border: 'var(--border-color)' },
  completed: { label: '已完成', bg: '#22c55e22', color: '#059669', border: '#6ee7b7' },
}

const PRIORITY_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  critical: { label: '危重', bg: '#ef444422', color: '#ef4444' },
  urgent: { label: '紧急', bg: '#f59e0b22', color: '#f59e0b' },
  normal: { label: '普通', bg: 'var(--bg-deep)', color: 'var(--text-secondary)' },
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

// [G005 Wave4A P1] 预约 DTO → 页面 Appointment 形状 (兼容后端 startAt/state 与 mock 本地形状)
const mapAppointmentDto = (d: any): Appointment => {
  if (d.examDate && d.status && d.patientName) {
    return { ...d, priority: d.priority === 'STAT' ? 'critical' : d.priority === 'URGENT' ? 'urgent' : (d.priority ?? 'normal') }
  }
  const start = d.startAt ? new Date(d.startAt) : new Date()
  const fmtDate = (dt: Date) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
  const stateMap: Record<string, Appointment['status']> = {
    SCHEDULED: 'pending', CONFIRMED: 'confirmed', CHECKED_IN: 'checked-in',
    IN_PROGRESS: 'checked-in', COMPLETED: 'completed', CANCELLED: 'cancelled', NO_SHOW: 'cancelled',
  }
  return {
    id: d.id,
    patientId: d.patientId ?? '',
    patientName: d.patientName ?? '未知患者',
    patientInitials: getNameInitials(d.patientName ?? ''),
    gender: d.gender ?? '未知',
    age: d.age ?? 0,
    idCard: d.idCard ?? '',
    phone: d.phone ?? '',
    examItemId: '',
    examItemName: d.bodyPart ? `${d.modality} ${d.bodyPart}` : (d.modality ?? '检查'),
    modality: d.modality ?? '',
    bodyPart: d.bodyPart ?? '',
    examDate: fmtDate(start),
    examTime: `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`,
    deviceId: d.deviceId ?? '',
    deviceName: d.deviceName ?? '',
    roomId: '',
    roomName: d.room ?? '',
    referringDoctorId: '',
    referringDoctorName: d.referringDoctor ?? '',
    clinicalDiagnosis: d.note ?? '',
    notes: d.note ?? '',
    status: stateMap[d.state] ?? 'pending',
    priority: d.priority === 'URGENT' ? 'urgent' : d.priority === 'STAT' ? 'critical' : 'normal',
    createdAt: d.createdAt ?? '',
    updatedAt: d.updatedAt ?? '',
  }
}

// ==================== 主组件 ====================
export default function AppointmentManagementPage() {
  const [appointments, setAppointments] = useState<Appointment[]>(generateMockAppointments())
  const [dataSource, setDataSource] = useState<'real' | 'demo'>('demo')
  const [listLoading, setListLoading] = useState(false)
  const [listError, setListError] = useState<string | null>(null)
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

  // [G005 Wave4A P1] 真实加载预约列表 (appointmentApi.list), 失败回退本地 mock + 演示徽标
  const loadAppointments = useCallback(async (silent = false) => {
    if (!silent) setListLoading(true)
    try {
      const { appointmentApi } = await import('../services/api/appointmentApi')
      const res = await appointmentApi.list({ take: 100 })
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        setAppointments(res.data.map(mapAppointmentDto))
        setDataSource('real')
        setListError(null)
      } else {
        setListError(t('apptMgmt.serviceUnavailable'))
        setDataSource('demo')
      }
    } catch {
      setListError(t('apptMgmt.serviceUnavailable'))
      setDataSource('demo')
    } finally {
      setListLoading(false)
    }
  }, [])

  useEffect(() => { void loadAppointments() }, [loadAppointments])

  // 弹窗状态
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showRescheduleModal, setShowRescheduleModal] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [showConflictModal, setShowConflictModal] = useState(false)
  const [conflictDetails, setConflictDetails] = useState<ConflictInfo[]>([])
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)

  // [W2-C] 新建预约 (appointmentApi.create)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createForm, setCreateForm] = useState({
    patientName: '', patientId: '', phone: '', modality: 'CT', examItemName: '',
    bodyPart: '', examDate: formatDateObj(new Date()), examTime: '09:00', priority: 'normal' as 'normal' | 'urgent' | 'critical',
    deviceName: '', clinicalDiagnosis: '',
  })
  const handleCreateAppointment = async () => {
    if (!createForm.patientName.trim() || !createForm.examItemName.trim()) return
    setCreating(true)
    try {
      const { appointmentApi } = await import('../services/api/appointmentApi')
      const res = await appointmentApi.create({
        patientName: createForm.patientName.trim(),
        patientId: createForm.patientId || uniqueId('P'),
        modality: createForm.modality,
        bodyPart: createForm.bodyPart || createForm.examItemName.trim(),
        startAt: `${createForm.examDate}T${createForm.examTime}:00`,
        endAt: `${createForm.examDate}T${createForm.examTime}:30`,
        deviceId: 'DEV-' + createForm.modality + '-01',
        deviceName: createForm.deviceName || `${createForm.modality}设备`,
        priority: (createForm.priority === 'urgent' ? 'URGENT' : createForm.priority === 'critical' ? 'STAT' : 'ROUTINE') as any,
        note: createForm.clinicalDiagnosis || '',
        referringDoctor: '当前用户',
        createdById: 'cur-user',
      })
      if (res.success) {
        setDataSource('real')
        const deviceName = createForm.deviceName || `${createForm.modality}设备`
        const newApt: Appointment = {
          id: `IMG-${String(appointments.length + 1).padStart(3, '0')}`,
          patientId: createForm.patientId || uniqueId('P'),
          patientName: createForm.patientName.trim(),
          patientInitials: getNameInitials(createForm.patientName.trim()),
          gender: '未知', age: 0, idCard: '', phone: createForm.phone || '',
          examItemId: 'EI-NEW', examItemName: createForm.examItemName.trim(),
          modality: createForm.modality, bodyPart: createForm.bodyPart || createForm.examItemName.trim(),
          examDate: createForm.examDate, examTime: createForm.examTime,
          deviceId: 'DEV-' + createForm.modality + '-01', deviceName,
          roomId: '', roomName: '', referringDoctorId: '', referringDoctorName: '当前用户',
          clinicalDiagnosis: createForm.clinicalDiagnosis || '', notes: '',
          status: 'pending', priority: createForm.priority,
          createdAt: new Date().toISOString().replace('T', ' ').slice(0, 16), updatedAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
        }
        setAppointments(prev => [...prev, newApt])
        setShowCreateModal(false)
        setCreateForm({ patientName: '', patientId: '', phone: '', modality: 'CT', examItemName: '', bodyPart: '', examDate: formatDateObj(new Date()), examTime: '09:00', priority: 'normal', deviceName: '', clinicalDiagnosis: '' })
      }
    } catch { /* 演示环境使用本地状态 */ }
    setCreating(false)
  }
  const [cancelReason, setCancelReason] = useState('')
  const [rescheduleData, setRescheduleData] = useState({ examDate: '', examTime: '', deviceId: '' })

  // [G005 W4B] 检查号解析 (GET /appointments/accession/parse)
  const [showAccessionModal, setShowAccessionModal] = useState(false)
  const [accessionInput, setAccessionInput] = useState('')
  const [accessionParsing, setAccessionParsing] = useState(false)
  const [accessionResult, setAccessionResult] = useState<AccessionParseResultDto | null>(null)
  const [accessionError, setAccessionError] = useState<string | null>(null)
  const handleParseAccession = async () => {
    const value = accessionInput.trim()
    if (!value) { setAccessionError(t('w4b.accession.needInput')); return }
    setAccessionParsing(true)
    setAccessionError(null)
    setAccessionResult(null)
    try {
      const { appointmentApi } = await import('../services/api/appointmentApi')
      const res = await appointmentApi.parseAccession(value)
      if (res.success && res.data) setAccessionResult(res.data)
      else setAccessionError(res.error?.message ?? t('w4b.accession.failed'))
    } catch {
      setAccessionError(t('w4b.accession.failed'))
    } finally {
      setAccessionParsing(false)
    }
  }

  // [G005 W4B] 改期历史 (GET /appointments/reschedule-history)
  const [showRescheduleHistory, setShowRescheduleHistory] = useState(false)
  const [rescheduleHistory, setRescheduleHistory] = useState<RescheduleRecordDto[]>([])
  const [rescheduleHistoryLoading, setRescheduleHistoryLoading] = useState(false)
  const [rescheduleHistoryError, setRescheduleHistoryError] = useState<string | null>(null)
  const loadRescheduleHistory = useCallback(async () => {
    setRescheduleHistoryLoading(true)
    setRescheduleHistoryError(null)
    try {
      const { appointmentApi } = await import('../services/api/appointmentApi')
      const res = await appointmentApi.getRescheduleHistory()
      if (res.success && Array.isArray(res.data)) setRescheduleHistory(res.data)
      else setRescheduleHistoryError(res.error?.message ?? t('w4b.reschedule.loadFailed'))
    } catch {
      setRescheduleHistoryError(t('w4b.reschedule.loadFailed'))
    } finally {
      setRescheduleHistoryLoading(false)
    }
  }, [])
  const openRescheduleHistory = () => {
    setShowRescheduleHistory((v) => {
      const next = !v
      if (next) void loadRescheduleHistory()
      return next
    })
  }
  const reasonLabel = (r: string) => {
    const key = `w4b.reason.${r}`
    const label = t(key)
    return label === key ? r : label
  }

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

  // 改约操作 ([G005 Wave4A P1] 真实 API 优先, 失败回退本地 + 演示徽标)
  const handleReschedule = async () => {
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

    try {
      const { appointmentApi } = await import('../services/api/appointmentApi')
      const res = await appointmentApi.update(selectedAppointment.id, {
        startAt: `${rescheduleData.examDate}T${rescheduleData.examTime}:00`,
        endAt: `${rescheduleData.examDate}T${rescheduleData.examTime}:30`,
      })
      if (res.success && (res.data === null || typeof res.data === 'object')) setDataSource('real')
      else setDataSource('demo')
    } catch { setDataSource('demo') }

    setAppointments(prev => prev.map(a => a.id === selectedAppointment.id ? updatedApt : a))
    setShowRescheduleModal(false)
    setSelectedAppointment(null)
    setRescheduleData({ examDate: '', examTime: '', deviceId: '' })
  }

  // 取消操作 ([G005 Wave4A P1] 真实 API 优先, 失败回退本地 + 演示徽标)
  const handleCancel = async () => {
    if (!selectedAppointment || !cancelReason) return

    // orderMachine: approved/scheduled/confirmed → cancelled via CANCEL (with reason)
    replayOrderEvent(selectedAppointment.status, { type: 'CANCEL', reason: cancelReason, by: 'system' })

    try {
      const { appointmentApi } = await import('../services/api/appointmentApi')
      const res = await appointmentApi.cancel(selectedAppointment.id)
      if (res.success && (res.data === null || typeof res.data === 'object')) setDataSource('real')
      else setDataSource('demo')
    } catch { setDataSource('demo') }

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
    container: { backgroundColor: COLORS.background,
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
      fontSize: '12px',
      color: COLORS.textSecondary,
      marginBottom: '8px',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
    },
    statValue: {
      fontSize: '30px',
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
      flexWrap: 'wrap' as const,
      gap: '12px',
    },
    toolbarLeft: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      flexWrap: 'wrap' as const,
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
      border: 'none', fontSize: '14px',
      flex: 1,
      backgroundColor: 'transparent',
    },
    select: {
      padding: '8px 12px',
      borderRadius: '8px',
      border: `1px solid ${COLORS.border}`,
      backgroundColor: COLORS.cardBackground,
      fontSize: '14px',
      cursor: 'pointer', },
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
      backgroundColor: 'var(--bg-card)',
      borderBottom: `1px solid ${COLORS.border}`,
      fontSize: '12px',
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
    badge: (bg: string | undefined, color: string | undefined) => ({
      display: 'inline-flex',
      alignItems: 'center',
      padding: '4px 10px',
      borderRadius: '20px',
      fontSize: '12px',
      fontWeight: '500',
      backgroundColor: bg,
      color: color,
    }),
    priorityDot: (color: string | undefined) => ({
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
        fontSize: '12px',
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
      fontSize: '12px',
      fontWeight: '500',
      color: COLORS.textSecondary,
      marginBottom: '6px',
    },
    formInput: {
      width: '100%',
      padding: '10px 12px',
      borderRadius: '8px',
      border: `1px solid ${COLORS.border}`,
      fontSize: '14px', boxSizing: 'border-box' as const,
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
      backgroundColor: 'var(--bg-card)',
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
      backgroundColor: 'var(--color-error-bg)',
      border: '1px solid #fecaca',
      borderRadius: '8px',
      marginBottom: '16px',
    },
  }

  return (
    <div style={styles.container}>
      {/* 头部 */}
      <div style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={styles.headerTitle}>
            <CalendarClock size={28} />
            {t('apptMgmt.title')}
          </div>
          {/* [G005 Wave4A P1] 数据源徽标 */}
          <span style={{
            fontSize: '12px', fontWeight: 600, padding: '3px 12px', borderRadius: 12,
            background: dataSource === 'real' ? 'rgba(22,163,74,0.25)' : 'rgba(245,158,11,0.3)',
            color: dataSource === 'real' ? '#d1fae5' : '#fde68a',
            border: `1px solid ${dataSource === 'real' ? '#34d399' : '#fbbf24'}`,
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: dataSource === 'real' ? '#34d399' : '#fbbf24',
            }} />
            {dataSource === 'real' ? t('apptMgmt.realData') : t('apptMgmt.demoData')}
          </span>
          {listLoading && <span style={{ fontSize: 12, opacity: 0.85 }}>{t('apptMgmt.loading')}</span>}
        </div>
        <div style={styles.headerSubtitle}>
          {t('apptMgmt.subtitle')}
          {listError && <span style={{ marginLeft: 12, opacity: 0.9 }}>({listError})</span>}
        </div>
      </div>

      <div style={styles.main}>
        {/* 统计卡片 */}
        <div style={styles.statsGrid}>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>
              <CalendarClock size={16} color={COLORS.primary} />
              {t('apptMgmt.todayAppointments')}
            </div>
            <div style={styles.statValue}>{statistics.todayTotal}</div>
            <div style={{ ...styles.statChange, color: COLORS.primary }}>{t('apptMgmt.thisWeekCases', { count: statistics.weekTotal })}</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>
              <Clock size={16} color={COLORS.warning} />
              {t('apptMgmt.pending')}
            </div>
            <div style={styles.statValue}>{statistics.pending}</div>
            <div style={{ ...styles.statChange, color: COLORS.warning }}>{t('apptMgmt.toProcess')}</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>
              <CheckCircle size={16} color={COLORS.success} />
              {t('apptMgmt.confirmed')}
            </div>
            <div style={{...styles.statValue, color: COLORS.success}}>{statistics.confirmed}</div>
            <div style={{ ...styles.statChange, color: COLORS.success }}>{t('apptMgmt.confirmed')}</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>
              <AlertTriangle size={16} color={COLORS.danger} />
              {t('apptMgmt.conflictDetection')}
            </div>
            <div style={{...styles.statValue, color: statistics.conflictCount > 0 ? COLORS.danger : COLORS.success}}>
              {statistics.conflictCount}
            </div>
            <div style={{ ...styles.statChange, color: COLORS.textSecondary }}>
              {statistics.conflictCount > 0 ? t('apptMgmt.hasConflict') : t('apptMgmt.noConflict')}
            </div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>
              <BarChart3 size={16} color={COLORS.info} />
              {t('apptMgmt.weekTotal')}
            </div>
            <div style={styles.statValue}>{statistics.weekTotal}</div>
            <div style={{ ...styles.statChange, color: COLORS.textSecondary }}>{t('apptMgmt.allStatus')}</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>
              <CheckCircle size={16} color={COLORS.success} />
              {t('apptMgmt.completed')}
            </div>
            <div style={styles.statValue}>{statistics.completed}</div>
            <div style={{ ...styles.statChange, color: COLORS.textSecondary }}>{t('apptMgmt.cumulativeCompleted')}</div>
          </div>
        </div>

        {/* 工具栏 */}
        <div style={styles.toolbar}>
          <div style={styles.toolbarLeft}>
            <div style={styles.searchBox}>
              <Search size={18} color={COLORS.textSecondary} />
              <input
                type="text"
                placeholder={t('apptMgmt.searchPlaceholder')}
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
              <option value="all">{t('apptMgmt.allStatus')}</option>
              <option value="pending">{t('apptMgmt.pending')}</option>
              <option value="confirmed">{t('apptMgmt.confirmed')}</option>
              <option value="checked-in">{t('apptMgmt.checkedIn')}</option>
              <option value="completed">{t('apptMgmt.completed')}</option>
              <option value="cancelled">{t('apptMgmt.cancelled')}</option>
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
                <X size={14} /> {t('apptMgmt.clearFilter')}
              </button>
            )}
          </div>
          <div style={styles.toolbarRight}>
            <div style={styles.viewToggle}>
              <button
                style={styles.viewBtn(viewMode === 'list')}
                onClick={() => setViewMode('list')}
              >
                <ListOrdered size={16} /> {t('apptMgmt.list')}
              </button>
              <button
                style={styles.viewBtn(viewMode === 'calendar')}
                onClick={() => setViewMode('calendar')}
              >
                <CalendarDays size={16} /> {t('apptMgmt.calendar')}
              </button>
            </div>
            {/* [G005 W4B] 检查号解析工具: GET /appointments/accession/parse */}
            <button onClick={() => { setAccessionInput(''); setAccessionResult(null); setAccessionError(null); setShowAccessionModal(true) }} style={{ ...styles.actionBtn('secondary'), display: 'flex', alignItems: 'center', gap: '4px' }}>
              <ScanLine size={16} /> {t('w4b.accession.tool')}
            </button>
            {/* [G005 W4B] 改期历史: GET /appointments/reschedule-history */}
            <button onClick={openRescheduleHistory} style={{ ...styles.actionBtn(showRescheduleHistory ? 'primary' : 'secondary'), display: 'flex', alignItems: 'center', gap: '4px' }}>
              <History size={16} /> {t('w4b.reschedule.tab')}
            </button>
            <button onClick={() => setShowCreateModal(true)} style={{ ...styles.actionBtn('primary'), display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Plus size={16} /> {t('apptMgmt.newAppointment')}
            </button>
          </div>
        </div>

        {/* [G005 W4B] 改期历史表 (GET /appointments/reschedule-history) */}
        {showRescheduleHistory && (
          <div style={{ ...styles.table, marginBottom: 16 }}>
            <div style={styles.tableHeader}>
              <div>{t('w4b.reschedule.thPatient')}</div>
              <div>{t('w4b.reschedule.thPhone')}</div>
              <div>{t('w4b.reschedule.thExam')}</div>
              <div>{t('w4b.reschedule.thOriginal')}</div>
              <div>{t('w4b.reschedule.thNew')}</div>
              <div>{t('w4b.reschedule.thReason')}</div>
              <div>{t('w4b.reschedule.thOperate')}</div>
              <div>
                <button style={{ ...styles.actionBtn('secondary'), padding: '2px 8px', fontSize: 12 }} onClick={() => void loadRescheduleHistory()}>{t('w4b.reschedule.refresh')}</button>
              </div>
            </div>
            {rescheduleHistoryLoading ? (
              <div style={{ padding: '24px', textAlign: 'center', color: COLORS.textSecondary }}>{t('apptMgmt.loading')}</div>
            ) : rescheduleHistoryError ? (
              <div style={{ padding: '24px', textAlign: 'center', color: COLORS.danger }}>{rescheduleHistoryError}</div>
            ) : rescheduleHistory.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: COLORS.textSecondary }}>{t('w4b.reschedule.empty')}</div>
            ) : rescheduleHistory.map((r, idx) => (
              <div key={r.id} style={{ ...styles.tableRow, backgroundColor: idx % 2 === 0 ? 'white' : '#fafafa' }}>
                <div style={{ fontWeight: 500 }}>{r.patientName}</div>
                <div style={{ fontSize: 12, color: COLORS.textSecondary }}>{r.phone}</div>
                <div>{r.examType}</div>
                <div>{r.originalDate} {r.originalTime}</div>
                <div style={{ color: COLORS.primary, fontWeight: 500 }}>{r.newDate} {r.newTime}</div>
                <div><span style={styles.badge('#f59e0b22', '#ca8a04')}>{reasonLabel(r.reason)}</span></div>
                <div style={{ fontSize: 12, color: COLORS.textSecondary }}>{r.operateTime}</div>
                <div />
              </div>
            ))}
          </div>
        )}

        {/* 列表视图 */}
        {viewMode === 'list' && (
          <div style={styles.table}>
            <div style={styles.tableHeader}>
              <div>{t('apptMgmt.colId')}</div>
              <div>{t('apptMgmt.colPatient')}</div>
              <div>{t('apptMgmt.colExamItem')}</div>
              <div>{t('apptMgmt.colBodyPart')}</div>
              <div>{t('apptMgmt.colTime')}</div>
              <div>{t('apptMgmt.colStatus')}</div>
              <div>{t('apptMgmt.colPriority')}</div>
              <div>{t('apptMgmt.colActions')}</div>
            </div>
            {filteredAppointments.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: COLORS.textSecondary }}>
                <CalendarClock size={48} style={{ marginBottom: '12px', opacity: 0.5 }} />
                <div>{t('apptMgmt.emptyAppointments')}</div>
              </div>
            ) : (
              filteredAppointments.map((apt, idx) => {
                const statusCfg = STATUS_CONFIG[apt.status] ?? STATUS_CONFIG.pending!
                const priorityCfg = PRIORITY_CONFIG[apt.priority] ?? PRIORITY_CONFIG.normal!
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
                      <div style={{ fontSize: '12px', color: COLORS.textSecondary }}>{apt.gender}/{apt.age}{t('apptMgmt.ageSuffix')}</div>
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
                        {hasConflict && <AlertTriangle size={14} style={{ marginRight: '4px' }} />}
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
                        title={t('apptMgmt.viewDetail')}
                      >
                        <CalendarCheck size={14} />
                      </button>
                      {apt.status !== 'cancelled' && apt.status !== 'completed' && (
                        <>
                          <button
                            style={styles.actionBtn('primary')}
                            onClick={() => openRescheduleModal(apt)}
                            title={t('apptMgmt.reschedule')}
                          >
                            <ArrowRightLeft size={14} />
                          </button>
                          <button
                            style={styles.actionBtn('danger')}
                            onClick={() => { setSelectedAppointment(apt); setShowCancelModal(true) }}
                            title={t('apptMgmt.cancelAppointment')}
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
                <ChevronLeft size={16} /> {t('apptMgmt.prevWeek')}
              </button>
              <div style={{ fontSize: '16px', fontWeight: '600' }}>
                {t('apptMgmt.weekRange', { m1: currentWeekStart.getMonth() + 1, d1: currentWeekStart.getDate(), m2: weekDates[6]!.getMonth() + 1, d2: weekDates[6]!.getDate() })}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  style={{ ...styles.actionBtn('secondary'), display: 'flex', alignItems: 'center', gap: '4px' }}
                  onClick={() => setCurrentWeekStart(new Date())}
                >
                  {t('apptMgmt.today')}
                </button>
                <button
                  style={{ ...styles.actionBtn('secondary'), display: 'flex', alignItems: 'center', gap: '4px' }}
                  onClick={() => {
                    const newStart = new Date(currentWeekStart)
                    newStart.setDate(currentWeekStart.getDate() + 7)
                    setCurrentWeekStart(newStart)
                  }}
                >
                  {t('apptMgmt.nextWeek')} <ChevronRight size={16} />
                </button>
              </div>
            </div>
            <div style={styles.calendarGrid}>
              {[t('apptMgmt.weekdayMon'), t('apptMgmt.weekdayTue'), t('apptMgmt.weekdayWed'), t('apptMgmt.weekdayThu'), t('apptMgmt.weekdayFri'), t('apptMgmt.weekdaySat'), t('apptMgmt.weekdaySun')].map(day => (
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
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedAppointment(apt); setShowDetailModal(true) } }}
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
                        {t('apptMgmt.more', { count: dayAppts.length - 3 })}
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
              <div style={styles.modalTitle}>{t('apptMgmt.detailTitle')}</div>
              <X size={20} style={{ cursor: 'pointer' }} onClick={() => setShowDetailModal(false)} />
            </div>

            {/* 冲突提示 */}
            {checkConflicts(selectedAppointment).length > 0 && (
              <div style={styles.conflictAlert}>
                <AlertTriangle size={20} color={COLORS.danger} />
                <div>
                  <div style={{ fontWeight: '600', color: COLORS.danger, marginBottom: '4px' }}>{t('apptMgmt.hasConflict')}</div>
                  {checkConflicts(selectedAppointment).map((c, i) => (
                    <div key={i} style={{ fontSize: '12px', color: COLORS.text }}>{c.message}</div>
                  ))}
                </div>
              </div>
            )}

            <div style={styles.formRow}>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>{t('apptMgmt.colId')}</label>
                <div style={{ padding: '10px', backgroundColor: 'var(--bg-card)', borderRadius: '8px', fontWeight: '500', color: COLORS.primary }}>
                  {selectedAppointment.id}
                </div>
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>{t('apptMgmt.colStatus')}</label>
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
                <label style={styles.formLabel}>{t('apptMgmt.labelPatientName')}</label>
                <div style={{ padding: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <User size={16} color={COLORS.textSecondary} />
                  {selectedAppointment.patientName}
                </div>
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>{t('apptMgmt.labelPatientInfo')}</label>
                <div style={{ padding: '10px', fontSize: '12px', color: COLORS.textSecondary }}>
                  {selectedAppointment.gender} / {selectedAppointment.age}{t('apptMgmt.ageSuffix')} / {selectedAppointment.idCard}
                </div>
              </div>
            </div>

            <div style={styles.formRow}>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>{t('apptMgmt.labelPhone')}</label>
                <div style={{ padding: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Phone size={16} color={COLORS.textSecondary} />
                  {selectedAppointment.phone}
                </div>
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>{t('apptMgmt.colPriority')}</label>
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
                <label style={styles.formLabel}>{t('apptMgmt.colExamItem')}</label>
                <div style={{ padding: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Scan size={16} color={COLORS.textSecondary} />
                  {selectedAppointment.examItemName}
                </div>
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>{t('apptMgmt.colBodyPart')}</label>
                <div style={{ padding: '10px' }}>
                  {selectedAppointment.bodyPart}（{selectedAppointment.modality}）
                </div>
              </div>
            </div>

            <div style={styles.formRow}>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>{t('apptMgmt.labelApptDate')}</label>
                <div style={{ padding: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CalendarClock size={16} color={COLORS.textSecondary} />
                  {formatDateCht(selectedAppointment.examDate)}
                </div>
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>{t('apptMgmt.labelApptTime')}</label>
                <div style={{ padding: '10px' }}>{selectedAppointment.examTime}</div>
              </div>
            </div>

            <div style={styles.formRow}>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>{t('apptMgmt.labelDevice')}</label>
                <div style={{ padding: '10px', fontSize: '12px' }}>{selectedAppointment.deviceName}</div>
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>{t('apptMgmt.labelLocation')}</label>
                <div style={{ padding: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <MapPin size={16} color={COLORS.textSecondary} />
                  {selectedAppointment.roomName}
                </div>
              </div>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.formLabel}>{t('apptMgmt.labelClinicalDiagnosis')}</label>
              <div style={{ padding: '10px', backgroundColor: 'var(--bg-card)', borderRadius: '8px', fontSize: '12px' }}>
                {selectedAppointment.clinicalDiagnosis}
              </div>
            </div>

            {selectedAppointment.notes && (
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>{t('apptMgmt.labelNotes')}</label>
                <div style={{ padding: '10px', backgroundColor: 'var(--color-warning-bg)', borderRadius: '8px', fontSize: '12px' }}>
                  {selectedAppointment.notes}
                </div>
              </div>
            )}

            {selectedAppointment.cancelReason && (
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>{t('apptMgmt.labelCancelReason')}</label>
                <div style={{ padding: '10px', backgroundColor: 'var(--color-error-bg)', borderRadius: '8px', fontSize: '12px', color: COLORS.danger }}>
                  {selectedAppointment.cancelReason === 'patient' ? t('apptMgmt.cancelReason.patient') :
                   selectedAppointment.cancelReason === 'device' ? t('apptMgmt.cancelReason.device') :
                   selectedAppointment.cancelReason === 'doctor' ? t('apptMgmt.cancelReason.doctor') :
                   selectedAppointment.cancelReason === 'reschedule' ? t('apptMgmt.cancelReason.reschedule') : t('apptMgmt.cancelReason.other')}
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
                    <ArrowRightLeft size={14} /> {t('apptMgmt.reschedule')}
                  </button>
                  <button
                    style={styles.actionBtn('danger')}
                    onClick={() => { setShowDetailModal(false); setShowCancelModal(true) }}
                  >
                    <XCircle size={14} /> {t('apptMgmt.cancelAppointment')}
                  </button>
                </>
              )}
              <button
                style={styles.actionBtn('secondary')}
                onClick={() => setShowDetailModal(false)}
              >
                {t('apptMgmt.close')}
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
              <div style={styles.modalTitle}>{t('apptMgmt.rescheduleTitle')}</div>
              <X size={20} style={{ cursor: 'pointer' }} onClick={() => setShowRescheduleModal(false)} />
            </div>

            <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: COLORS.primaryLight, borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', color: COLORS.textSecondary }}>{t('apptMgmt.currentAppointment')}</div>
              <div style={{ fontWeight: '500', marginTop: '4px' }}>
                {selectedAppointment.patientName} - {selectedAppointment.examItemName}
              </div>
              <div style={{ fontSize: '12px', color: COLORS.textSecondary, marginTop: '4px' }}>
                {selectedAppointment.examDate} {selectedAppointment.examTime} @ {selectedAppointment.deviceName}
              </div>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.formLabel}>{t('apptMgmt.newDate')}</label>
              <input
                type="date"
                style={styles.formInput}
                value={rescheduleData.examDate}
                onChange={e => setRescheduleData({ ...rescheduleData, examDate: e.target.value })}
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.formLabel}>{t('apptMgmt.newTime')}</label>
              <select
                style={styles.formInput}
                value={rescheduleData.examTime}
                onChange={e => setRescheduleData({ ...rescheduleData, examTime: e.target.value })}
              >
                <option value="">{t('apptMgmt.selectTime')}</option>
                {timeSlots.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            {/* 改约后冲突检测预览 */}
            {rescheduleData.examDate && rescheduleData.examTime && (
              <div style={styles.conflictAlert}>
                <AlertTriangle size={20} color={COLORS.warning} />
                <div style={{ fontSize: '12px' }}>
                  {t('apptMgmt.rescheduleHint')}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
              <button
                style={styles.actionBtn('secondary')}
                onClick={() => setShowRescheduleModal(false)}
              >
                {t('apptMgmt.cancel')}
              </button>
              <button
                style={styles.actionBtn('primary')}
                onClick={() => void handleReschedule()}
                disabled={!rescheduleData.examDate || !rescheduleData.examTime}
              >
                <Check size={14} /> {t('apptMgmt.confirmReschedule')}
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
              <div style={styles.modalTitle}>{t('apptMgmt.conflictTitle')}</div>
              <X size={20} style={{ cursor: 'pointer' }} onClick={() => setShowConflictModal(false)} />
            </div>
            <div style={{ padding: '16px' }}>
              <div style={{ marginBottom: '12px', padding: '12px', backgroundColor: 'var(--color-warning-bg)', borderRadius: '8px', border: `1px solid ${COLORS.warning}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <AlertTriangle size={18} color={COLORS.warning} />
                  <span style={{ fontWeight: 600, color: COLORS.warning }}>{t('apptMgmt.conflictsFound', { count: conflictDetails.length })}</span>
                </div>
                <div style={{ fontSize: 12, color: (COLORS as Record<string, string | undefined>).textDark }}>
                  {t('apptMgmt.conflictHint')}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {conflictDetails.map((conflict, index) => (
                  <div key={index} style={{ padding: '10px 12px', backgroundColor: 'var(--bg-card)', borderRadius: 6, border: `1px solid ${COLORS.border}`, fontSize: 12 }}>
                    <div style={{ fontWeight: 500, marginBottom: 4 }}>{conflict.message}</div>
                    {conflict.relatedAppointmentId && (
                      <div style={{ fontSize: 12, color: (COLORS as Record<string, string | undefined>).textMuted }}>{t('apptMgmt.relatedApptId', { id: conflict.relatedAppointmentId })}</div>
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
                {t('apptMgmt.gotIt')}
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
              <div style={styles.modalTitle}>{t('apptMgmt.cancelTitle')}</div>
              <X size={20} style={{ cursor: 'pointer' }} onClick={() => setShowCancelModal(false)} />
            </div>

            <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: 'var(--color-error-bg)', borderRadius: '8px' }}>
              <div style={{ fontWeight: '500', color: COLORS.danger }}>
                {selectedAppointment.patientName} - {selectedAppointment.examItemName}
              </div>
              <div style={{ fontSize: '12px', color: COLORS.textSecondary, marginTop: '4px' }}>
                {selectedAppointment.examDate} {selectedAppointment.examTime}
              </div>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.formLabel}>{t('apptMgmt.cancelReasonLabel')}</label>
              <select
                style={styles.formInput}
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
              >
                <option value="">{t('apptMgmt.selectCancelReason')}</option>
                <option value="patient">{t('apptMgmt.cancelReason.patient')}</option>
                <option value="device">{t('apptMgmt.cancelReason.device')}</option>
                <option value="doctor">{t('apptMgmt.cancelReason.doctor')}</option>
                <option value="reschedule">{t('apptMgmt.cancelReason.reschedule')}</option>
                <option value="other">{t('apptMgmt.cancelReason.other')}</option>
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
              <button
                style={styles.actionBtn('secondary')}
                onClick={() => setShowCancelModal(false)}
              >
                {t('apptMgmt.back')}
              </button>
              <button
                style={styles.actionBtn('danger')}
                onClick={() => void handleCancel()}
                disabled={!cancelReason}
              >
                <XCircle size={14} /> {t('apptMgmt.confirmCancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 新建预约弹窗 */}
      {showCreateModal && (
        <div style={styles.modal} onClick={() => setShowCreateModal(false)}>
          <div style={{ ...styles.modalContent, maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div style={styles.modalTitle}>{t('apptMgmt.createTitle')}</div>
              <X size={20} style={{ cursor: 'pointer' }} onClick={() => setShowCreateModal(false)} />
            </div>
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>{t('apptMgmt.patientNameLabel')}</label>
                <input style={styles.formInput} value={createForm.patientName} onChange={e => setCreateForm({ ...createForm, patientName: e.target.value })} placeholder={t('apptMgmt.patientNamePlaceholder')} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>{t('apptMgmt.patientIdLabel')}</label>
                  <input style={styles.formInput} value={createForm.patientId} onChange={e => setCreateForm({ ...createForm, patientId: e.target.value })} placeholder={t('apptMgmt.patientIdPlaceholder')} />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>{t('apptMgmt.labelPhone')}</label>
                  <input style={styles.formInput} value={createForm.phone} onChange={e => setCreateForm({ ...createForm, phone: e.target.value })} placeholder={t('apptMgmt.optional')} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>{t('apptMgmt.examItemLabel')}</label>
                  <input style={styles.formInput} value={createForm.examItemName} onChange={e => setCreateForm({ ...createForm, examItemName: e.target.value })} placeholder={t('apptMgmt.examItemPlaceholder')} />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>{t('apptMgmt.modalityLabel')}</label>
                  <select style={styles.formInput} value={createForm.modality} onChange={e => setCreateForm({ ...createForm, modality: e.target.value })}>
                    {['CT', 'MR', 'DR', 'DSA', 'MG', 'GI', '超声', 'PET-CT'].map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>{t('apptMgmt.colBodyPart')}</label>
                <input style={styles.formInput} value={createForm.bodyPart} onChange={e => setCreateForm({ ...createForm, bodyPart: e.target.value })} placeholder={t('apptMgmt.optional')} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>{t('apptMgmt.dateLabel')}</label>
                  <input type="date" style={styles.formInput} value={createForm.examDate} onChange={e => setCreateForm({ ...createForm, examDate: e.target.value })} />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>{t('apptMgmt.timeLabel')}</label>
                  <select style={styles.formInput} value={createForm.examTime} onChange={e => setCreateForm({ ...createForm, examTime: e.target.value })}>
                    {timeSlots.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>{t('apptMgmt.colPriority')}</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {([['normal', t('apptMgmt.priority.normal')], ['urgent', t('apptMgmt.priority.urgent')], ['critical', t('apptMgmt.priority.critical')]] as const).map(([v, l]) => (
                    <button key={v} onClick={() => setCreateForm({ ...createForm, priority: v })}
                      style={{
                        flex: 1, padding: '8px 0', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        border: `1px solid ${createForm.priority === v ? COLORS.primary : COLORS.border}`,
                        background: createForm.priority === v ? COLORS.primaryLight : '#fff',
                        color: createForm.priority === v ? COLORS.primary : COLORS.textSecondary,
                      }}>{l}</button>
                  ))}
                </div>
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>{t('apptMgmt.labelClinicalDiagnosis')}</label>
                <input style={styles.formInput} value={createForm.clinicalDiagnosis} onChange={e => setCreateForm({ ...createForm, clinicalDiagnosis: e.target.value })} placeholder={t('apptMgmt.optional')} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                <button style={styles.actionBtn('secondary')} onClick={() => setShowCreateModal(false)}>{t('apptMgmt.cancel')}</button>
                <button style={styles.actionBtn('primary')} onClick={() => void handleCreateAppointment()} disabled={!createForm.patientName.trim() || !createForm.examItemName.trim() || creating}>
                  {creating ? t('apptMgmt.creating') : <><Plus size={14} /> {t('apptMgmt.confirmCreate')}</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* [G005 W4B] 检查号解析弹窗 (GET /appointments/accession/parse) */}
      {showAccessionModal && (
        <div style={styles.modal} onClick={() => setShowAccessionModal(false)}>
          <div style={{ ...styles.modalContent, maxWidth: 460 }} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div style={styles.modalTitle}>{t('w4b.accession.title')}</div>
              <X size={20} style={{ cursor: 'pointer' }} onClick={() => setShowAccessionModal(false)} />
            </div>
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  style={{ ...styles.formInput, flex: 1 }}
                  value={accessionInput}
                  onChange={e => setAccessionInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') void handleParseAccession() }}
                  placeholder={t('w4b.accession.placeholder')}
                />
                <button style={styles.actionBtn('primary')} onClick={() => void handleParseAccession()} disabled={accessionParsing}>
                  <ScanLine size={14} /> {accessionParsing ? t('apptMgmt.loading') : t('w4b.accession.parse')}
                </button>
              </div>
              {accessionError && <div style={{ color: COLORS.danger, fontSize: 12 }}>{accessionError}</div>}
              {accessionResult && (
                accessionResult.valid ? (
                  <div style={{ padding: 12, borderRadius: 8, background: '#22c55e22', border: '1px solid #6ee7b7' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: COLORS.success, fontWeight: 600, marginBottom: 8 }}>
                      <CheckCircle size={16} /> {t('w4b.accession.valid')}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
                      <div><span style={{ color: COLORS.textSecondary }}>{t('w4b.accession.modality')}: </span><b>{accessionResult.modality}</b></div>
                      <div><span style={{ color: COLORS.textSecondary }}>{t('w4b.accession.year')}: </span><b>{accessionResult.year}</b></div>
                      <div><span style={{ color: COLORS.textSecondary }}>{t('w4b.accession.seq')}: </span><b>{accessionResult.seq}</b></div>
                      <div><span style={{ color: COLORS.textSecondary }}>{t('w4b.accession.check')}: </span><b>{accessionResult.check}</b></div>
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: 12, borderRadius: 8, background: 'var(--color-error-bg)', border: '1px solid #fecaca', color: COLORS.danger, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <XCircle size={16} /> {t('w4b.accession.invalid')}
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
