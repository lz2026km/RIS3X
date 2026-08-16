// @ts-nocheck
// ============================================================
// G005 放射科RIS系统 - 临床数据中心/中台 v1.0.0
// 功能：患者360视图 + 跨系统数据同步 + 数据质量监控
// ============================================================
import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Search, User, Phone, AlertCircle, Calendar, Plus, X, ChevronLeft, ChevronRight,
  Eye, Edit2, FileText, BarChart2, Download, RefreshCw, Filter, ChevronDown, ChevronUp,
  Users, UserCheck, Clock, Activity, Heart, AlertTriangle, CheckCircle, XCircle,
  TrendingUp, FilterX, Save, ArrowLeft, Stethoscope, Shield, MapPin,
  Contact, CreditCard, History, Image, PlusCircle, Trash2, UserPlus, Database,
  Server, Network, RefreshCw as SyncIcon, Check, AlertOctagon, ShieldCheck, 
  Clock as ClockIcon, ArrowRight, ArrowDown, Droplet, Wifi, WifiOff, 
  Activity as ActivityIcon, PieChart as PieChartIcon,
  TrendingDown, Pause, Play, Settings, MoreVertical, Bell, BellOff, EyeOff
} from 'lucide-react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  AreaChart,
  Area,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from 'recharts'
import { initialPatients, initialRadiologyExams } from '../data/initialData'
import { patientApi, examApi } from '../services/api'
import { LoadingBanner, ErrorBanner } from '../components/feedback'
import type { Patient } from '../types'
import { t } from '../i18n/appI18n'

// ==================== 类型定义 ====================
type TabKey = 'patient360' | 'sync' | 'quality' | 'search'
type SyncStatus = '同步中' | '已同步' | '失败' | '待同步'
type QualityLevel = '优' | '良' | '中' | '差'
type DataSource = 'HIS' | 'LIS' | 'RIS' | 'PACS' | 'EMR'

interface SyncRecord {
  id: string
  systemName: string
  systemType: 'HIS' | 'PACS' | 'EMR' | 'LIS' | 'RIS'
  recordType: string
  patientId: string
  patientName: string
  syncTime: string
  status: SyncStatus
  errorMsg?: string
  retryCount: number
}

interface QualityMetric {
  category: string
  metric: string
  score: number
  level: QualityLevel
  issueCount: number
  trend: 'up' | 'down' | 'stable'
  description: string
}

interface Patient360Data {
  patientId: string
  name: string
  gender: string
  age: number
  phone: string
  idCard: string
  patientType: string
  lastVisit: string
  totalVisits: number
  allergyHistory: string[]
  diagnoses: { date: string; diagnosis: string; doctor: string; source: DataSource }[]
  exams: { id: string; examType: string; date: string; result: string; modality: string; source: DataSource }[]
  medications: { name: string; dosage: string; frequency: string; startDate: string; source: DataSource }[]
  vitals: { date: string; bp: string; hr: number; temp: number; weight?: number; source: DataSource }[]
  labResults: { date: string; item: string; value: string; ref: string; source: DataSource }[]
}

interface TimelineEvent {
  id: string
  date: string
  type: 'diagnosis' | 'lab' | 'medication' | 'imaging' | 'vital'
  title: string
  description: string
  source: DataSource
  doctor?: string
}

interface CDRSearchResult {
  patientId: string
  name: string
  gender: string
  age: number
  matchType: 'id' | 'name'
  matchValue: string
  lastVisit: string
  dataSources: DataSource[]
}

interface SystemConnectionStatus {
  type: DataSource
  name: string
  status: 'online' | 'offline' | 'degraded'
  lastSyncTime: string
  recordCount: number
  errorCount: number
  alertMessage?: string
}

// ==================== 样式常量 ====================
const COLORS = {
  primary: '#1e40af',
  primaryLight: '#3b82f6',
  secondary: '#0891b2',
  success: '#16a34a',
  successLight: '#dcfce7',
  warning: '#d97706',
  warningLight: '#fef3c7',
  danger: '#dc2626',
  dangerLight: '#fee2e2',
  bgGray: '#f1f5f9',
  cardWhite: 'var(--bg-card)',
  textDark: '#1f2937',
  textMuted: '#6b7280',
  border: 'var(--border-color)',
  purple: '#8b5cf6',
  purpleLight: '#ede9fe',
  orange: '#f97316',
  orangeLight: '#ffedd5',
  cyan: '#06b6d4',
  cyanLight: '#cffafe',
  pink: '#ec4899',
  pinkLight: '#fce7f3',
  his: '#3b82f6',
  pacs: '#8b5cf6',
  emr: '#10b981',
  lis: '#f59e0b',
  ris: '#06b6d4'
}

const styles = {
  pageContainer: {
    minHeight: '100vh',
    backgroundColor: COLORS.bgGray,
    fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
    fontSize: '14px',
    color: COLORS.textDark,
  },
  header: {
    background: 'linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%)',
    color: 'white',
    padding: '16px 24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
  },
  headerTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    fontSize: '20px',
    fontWeight: 700,
  },
  headerSubtitle: {
    fontSize: '12px',
    opacity: 0.85,
    marginTop: '2px',
  },
  headerActions: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
  },
  headerBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    border: '1px solid rgba(255,255,255,0.3)',
    color: 'white',
    padding: '8px 16px',
    borderRadius: '6px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '13px',
    transition: 'all 0.2s',
  },
  content: {
    padding: '20px 24px',
    maxWidth: '1600px',
    margin: '0 auto',
  },
  tabContainer: {
    display: 'flex',
    gap: '4px',
    backgroundColor: 'var(--bg-card)',
    padding: '6px',
    borderRadius: '10px',
    marginBottom: '20px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  },
  tab: (active: boolean) => ({
    flex: 1,
    padding: '10px 20px',
    borderRadius: '6px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 500,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    transition: 'all 0.2s',
    backgroundColor: active ? COLORS.primary : 'transparent',
    color: active ? '#fff' : COLORS.textMuted,
  }),
  card: {
    backgroundColor: 'var(--bg-card)',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    marginBottom: '16px',
  },
  cardTitle: {
    fontSize: '16px',
    fontWeight: 600,
    color: COLORS.textDark,
    marginBottom: '16px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  statGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
    marginBottom: '20px',
  },
  statCard: (color: string, bgColor: string) => ({
    backgroundColor: bgColor,
    borderRadius: '10px',
    padding: '16px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  }),
  statIcon: (color: string) => ({
    width: '44px',
    height: '44px',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color,
    color: '#fff',
  }),
  statValue: {
    fontSize: '28px',
    fontWeight: 700,
    color: COLORS.textDark,
  },
  statLabel: {
    fontSize: '12px',
    color: COLORS.textMuted,
    marginTop: '2px',
  },
  statChange: (positive: boolean) => ({
    fontSize: '11px',
    color: positive ? COLORS.success : COLORS.danger,
    display: 'flex',
    alignItems: 'center',
    gap: '2px',
    marginTop: '4px',
  }),
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
  },
  th: {
    backgroundColor: COLORS.bgGray,
    padding: '12px 16px',
    textAlign: 'left' as const,
    fontWeight: 600,
    fontSize: '13px',
    color: COLORS.textMuted,
    borderBottom: `1px solid ${COLORS.border}`,
  },
  td: {
    padding: '12px 16px',
    borderBottom: `1px solid ${COLORS.border}`,
    fontSize: '13px',
  },
  badge: (color: string, bgColor: string) => ({
    padding: '4px 10px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: 500,
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    color,
    backgroundColor: bgColor,
  }),
  searchBar: {
    display: 'flex',
    gap: '12px',
    marginBottom: '16px',
    flexWrap: 'wrap' as const,
  },
  searchInput: {
    flex: 1,
    minWidth: '200px',
    padding: '10px 16px',
    border: `1px solid ${COLORS.border}`,
    borderRadius: '8px',
    fontSize: '14px',
    outline: 'none',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  select: {
    padding: '10px 16px',
    border: `1px solid ${COLORS.border}`,
    borderRadius: '8px',
    fontSize: '14px',
    outline: 'none',
    backgroundColor: 'var(--bg-card)',
    minWidth: '120px',
  },
  btn: (color: string) => ({
    backgroundColor: color,
    color: '#fff',
    border: 'none',
    padding: '8px 16px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    transition: 'all 0.2s',
  }),
  btnOutline: (color: string) => ({
    backgroundColor: 'var(--bg-card)',
    color,
    border: `1px solid ${color}`,
    padding: '8px 16px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    transition: 'all 0.2s',
  }),
  input: {
    width: '100%',
    padding: '10px 14px',
    border: `1px solid ${COLORS.border}`,
    borderRadius: '8px',
    fontSize: '14px',
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  grid2: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '16px',
  },
  grid3: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '16px',
  },
  avatar: (color: string) => ({
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    backgroundColor: color,
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 600,
    fontSize: '14px',
  }),
  progress: (percent: number, color: string) => ({
    width: '100%',
    height: '8px',
    backgroundColor: COLORS.bgGray,
    borderRadius: '4px',
    overflow: 'hidden',
    position: 'relative',
  }),
  progressBar: (percent: number, color: string) => ({
    height: '100%',
    width: `${percent}%`,
    backgroundColor: color,
    borderRadius: '4px',
    transition: 'width 0.3s',
  }),
  qualityBar: (level: QualityLevel) => {
    const colors: Record<QualityLevel, string> = {
      '优': COLORS.success,
      '良': COLORS.primaryLight,
      '中': COLORS.warning,
      '差': COLORS.danger,
    }
    return {
      width: '60px',
      height: '6px',
      backgroundColor: COLORS.bgGray,
      borderRadius: '3px',
      overflow: 'hidden',
    }
  },
}

// ==================== 模拟数据 ====================
const generateSyncRecords = (): SyncRecord[] => {
  const systems = [
    { name: '医院信息系统', type: 'HIS' as const },
    { name: '影像归档系统', type: 'PACS' as const },
    { name: '电子病历系统', type: 'EMR' as const },
    { name: '检验信息系统', type: 'LIS' as const },
    { name: '放射信息系统', type: 'RIS' as const },
  ]
  const recordTypes = ['患者信息', '检查申请', '报告结果', '医嘱信息', '诊断信息']
  const statuses: SyncStatus[] = ['同步中', '已同步', '失败', '待同步']
  const patients = initialPatients.slice(0, 15)
  
  return systems.flatMap((sys, sysIdx) =>
    Array.from({ length: 8 }, (_, i) => {
      const patient = patients[(sysIdx * 3 + i) % patients.length]
      const status = statuses[Math.floor(Math.random() * statuses.length)]
      return {
        id: `sync-${sysIdx}-${i}`,
        systemName: sys.name,
        systemType: sys.type,
        recordType: recordTypes[Math.floor(Math.random() * recordTypes.length)],
        patientId: patient.id,
        patientName: patient.name,
        syncTime: new Date(Date.now() - Math.random() * 86400000 * 3).toLocaleString('zh-CN'),
        status,
        errorMsg: status === '失败' ? '连接超时，数据未返回' : undefined,
        retryCount: status === '失败' ? Math.floor(Math.random() * 3) + 1 : 0,
      }
    })
  )
}

const generateQualityMetrics = (): QualityMetric[] => [
  { category: '数据完整性', metric: '患者信息完整率', score: 96.5, level: '优', issueCount: 12, trend: 'up', description: '基本信息、联系方式、医保信息等完整度' },
  { category: '数据完整性', metric: '检查报告完整率', score: 94.2, level: '优', issueCount: 8, trend: 'stable', description: '报告内容、签名、审核状态完整度' },
  { category: '数据完整性', metric: '诊断信息完整率', score: 88.7, level: '良', issueCount: 23, trend: 'up', description: '初诊、复诊诊断编码及描述完整度' },
  { category: '数据准确性', metric: '身份信息准确率', score: 99.8, level: '优', issueCount: 2, trend: 'stable', description: '身份证、姓名、性别等身份核验准确度' },
  { category: '数据准确性', metric: '检查数据准确率', score: 97.3, level: '优', issueCount: 5, trend: 'up', description: '检查号、设备参数、检查部位准确度' },
  { category: '数据准确性', metric: '报告数据准确率', score: 95.1, level: '优', issueCount: 7, trend: 'down', description: '报告内容、诊断结论、医学术语准确度' },
  { category: '数据时效性', metric: '实时同步及时率', score: 92.4, level: '良', issueCount: 18, trend: 'up', description: '数据从源系统到中台的同步时效' },
  { category: '数据时效性', metric: '报告出具及时率', score: 87.6, level: '良', issueCount: 31, trend: 'stable', description: '从检查完成到报告出具的时效' },
  { category: '数据时效性', metric: '危急值通知及时率', score: 98.9, level: '优', issueCount: 1, trend: 'stable', description: '危急值发现到临床通知的时效' },
  { category: '数据一致性', metric: '跨系统数据一致率', score: 85.3, level: '中', issueCount: 42, trend: 'down', description: 'HIS/PACS/EMR/RIS多系统数据一致性' },
  { category: '数据一致性', metric: '历史数据一致率', score: 91.2, level: '良', issueCount: 19, trend: 'stable', description: '同一患者多次就诊数据的一致性' },
  { category: '数据标准化', metric: '诊断编码标准化率', score: 93.8, level: '优', issueCount: 11, trend: 'up', description: 'ICD-10编码使用规范程度' },
  { category: '数据标准化', metric: '检查项目标准化率', score: 89.5, level: '良', issueCount: 16, trend: 'up', description: '检查项目名称与编码对应规范度' },
]

const generatePatient360 = (patientId: string): Patient360Data => {
  const patient = initialPatients.find(p => p.id === patientId) || initialPatients[0]
  const exams = initialRadiologyExams.filter(e => e.patientId === patientId).slice(0, 5)
  
  return {
    patientId: patient.id,
    name: patient.name,
    gender: patient.gender,
    age: patient.age || 45,
    phone: patient.phone || '138-xxxx-xxxx',
    idCard: patient.idCard || '1101011990xxxxxx',
    patientType: patient.patientType || '门诊',
    lastVisit: exams[0]?.examDate || '2026-04-15',
    totalVisits: exams.length + Math.floor(Math.random() * 10),
    allergyHistory: ['青霉素', '花粉'],
    diagnoses: [
      { date: '2026-04-10', diagnosis: '左肺上叶结节', doctor: '张主任', source: 'EMR' },
      { date: '2026-03-15', diagnosis: '颈椎退行性病变', doctor: '李医生', source: 'EMR' },
      { date: '2026-01-20', diagnosis: '腰椎间盘突出', doctor: '王医生', source: 'EMR' },
    ],
    exams: exams.map(e => ({
      id: e.id,
      examType: e.examType,
      date: e.examDate,
      result: e.findings || '未见明显异常',
      modality: e.modality,
      source: 'RIS' as DataSource,
    })),
    medications: [
      { name: '氨氯地平', dosage: '5mg', frequency: '每日一次', startDate: '2026-03-01', source: 'HIS' },
      { name: '阿司匹林', dosage: '100mg', frequency: '每日一次', startDate: '2026-01-15', source: 'HIS' },
    ],
    vitals: [
      { date: '2026-04-28', bp: '128/82', hr: 76, temp: 36.5, weight: 68, source: 'HIS' },
      { date: '2026-04-20', bp: '132/85', hr: 80, temp: 36.8, weight: 67, source: 'HIS' },
      { date: '2026-04-10', bp: '125/80', hr: 72, temp: 36.4, weight: 68, source: 'HIS' },
    ],
    labResults: [
      { date: '2026-04-20', item: '血红蛋白', value: '142 g/L', ref: '120-160 g/L', source: 'LIS' },
      { date: '2026-04-20', item: '白细胞计数', value: '6.8×10⁹/L', ref: '4-10×10⁹/L', source: 'LIS' },
      { date: '2026-04-20', item: '血小板计数', value: '215×10⁹/L', ref: '100-300×10⁹/L', source: 'LIS' },
    ],
  }
}

const generateTimelineEvents = (patientData: Patient360Data): TimelineEvent[] => {
  const events: TimelineEvent[] = []
  
  // Add diagnoses
  patientData.diagnoses.forEach((d, i) => {
    events.push({
      id: `diag-${i}`,
      date: d.date,
      type: 'diagnosis',
      title: d.diagnosis,
      description: `诊断医生: ${d.doctor}`,
      source: d.source,
      doctor: d.doctor,
    })
  })
  
  // Add lab results
  patientData.labResults.forEach((l, i) => {
    events.push({
      id: `lab-${i}`,
      date: l.date,
      type: 'lab',
      title: l.item,
      description: `结果: ${l.value} (参考值: ${l.ref})`,
      source: l.source,
    })
  })
  
  // Add medications
  patientData.medications.forEach((m, i) => {
    events.push({
      id: `med-${i}`,
      date: m.startDate,
      type: 'medication',
      title: m.name,
      description: `${m.dosage} | ${m.frequency}`,
      source: m.source,
    })
  })
  
  // Add imaging exams
  patientData.exams.forEach((e, i) => {
    events.push({
      id: `img-${i}`,
      date: e.date,
      type: 'imaging',
      title: e.examType,
      description: `${e.modality} | ${e.result.substring(0, 50)}...`,
      source: e.source,
    })
  })
  
  // Add vital signs
  patientData.vitals.forEach((v, i) => {
    events.push({
      id: `vital-${i}`,
      date: v.date,
      type: 'vital',
      title: '生命体征',
      description: `BP: ${v.bp} | HR: ${v.hr}bpm | Temp: ${v.temp}°C${v.weight ? ` | 体重: ${v.weight}kg` : ''}`,
      source: v.source,
    })
  })
  
  // Sort by date descending
  return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

const generateSystemConnectionStatus = (): SystemConnectionStatus[] => [
  { type: 'HIS', name: '医院信息系统', status: 'online', lastSyncTime: new Date(Date.now() - 120000).toLocaleTimeString('zh-CN'), recordCount: 12580, errorCount: 2 },
  { type: 'LIS', name: '检验信息系统', status: 'degraded', lastSyncTime: new Date(Date.now() - 300000).toLocaleTimeString('zh-CN'), recordCount: 3420, errorCount: 8, alertMessage: '部分检验项目同步延迟' },
  { type: 'RIS', name: '放射信息系统', status: 'online', lastSyncTime: new Date(Date.now() - 60000).toLocaleTimeString('zh-CN'), recordCount: 8920, errorCount: 0 },
  { type: 'PACS', name: '影像归档系统', status: 'online', lastSyncTime: new Date(Date.now() - 180000).toLocaleTimeString('zh-CN'), recordCount: 4560, errorCount: 1 },
  { type: 'EMR', name: '电子病历系统', status: 'online', lastSyncTime: new Date(Date.now() - 90000).toLocaleTimeString('zh-CN'), recordCount: 7840, errorCount: 3 },
]

const generateQualityDimensions = () => [
  { dimension: '完整性', subDimension: '完整度', score: 94.5, level: '优' as QualityLevel, trend: 'up' as const, description: '数据字段完整程度', metrics: ['患者信息完整率', '检查报告完整率', '诊断信息完整率'] },
  { dimension: '及时性', subDimension: '及时度', score: 91.2, level: '良' as QualityLevel, trend: 'stable' as const, description: '数据更新时效性', metrics: ['实时同步及时率', '报告出具及时率', '危急值通知及时率'] },
  { dimension: '准确性', subDimension: '准确度', score: 97.1, level: '优' as QualityLevel, trend: 'up' as const, description: '数据准确可信程度', metrics: ['身份信息准确率', '检查数据准确率', '报告数据准确率'] },
  { dimension: '一致性', subDimension: '一致度', score: 88.3, level: '良' as QualityLevel, trend: 'down' as const, description: '跨系统数据一致程度', metrics: ['跨系统数据一致率', '历史数据一致率', '诊断编码标准化率'] },
]

const searchCDRData = (query: string): CDRSearchResult[] => {
  if (!query || query.length < 2) return []
  const q = query.toLowerCase()
  return initialPatients
    .filter(p => 
      p.name.toLowerCase().includes(q) || 
      p.id.toLowerCase().includes(q) ||
      p.phone?.includes(q)
    )
    .slice(0, 10)
    .map(p => ({
      patientId: p.id,
      name: p.name,
      gender: p.gender,
      age: p.age || 45,
      matchType: p.id.toLowerCase().includes(q) ? 'id' : 'name',
      matchValue: p.id.toLowerCase().includes(q) ? p.id : p.name,
      lastVisit: '2026-04-28',
      dataSources: ['HIS', 'LIS', 'RIS', 'PACS', 'EMR'] as DataSource[],
    }))
}

// ==================== 辅助组件 ====================
const StatusBadge = ({ status }: { status: SyncStatus }) => {
  const config: Record<SyncStatus, { color: string; bg: string; icon: React.ReactNode }> = {
    '同步中': { color: COLORS.primary, bg: '#3b82f622', icon: <SyncIcon size={14} /> },
    '已同步': { color: COLORS.success, bg: COLORS.successLight, icon: <Check size={14} /> },
    '失败': { color: COLORS.danger, bg: COLORS.dangerLight, icon: <AlertOctagon size={14} /> },
    '待同步': { color: COLORS.warning, bg: COLORS.warningLight, icon: <ClockIcon size={14} /> },
  }
  const c = config[status]
  return (
    <span style={styles.badge(c.color, c.bg)}>
      {c.icon}
      {status}
    </span>
  )
}

const QualityBadge = ({ level }: { level: QualityLevel }) => {
  const config: Record<QualityLevel, { color: string; bg: string }> = {
    '优': { color: COLORS.success, bg: COLORS.successLight },
    '良': { color: COLORS.primaryLight, bg: '#3b82f622' },
    '中': { color: COLORS.warning, bg: COLORS.warningLight },
    '差': { color: COLORS.danger, bg: COLORS.dangerLight },
  }
  const c = config[level]
  return <span style={styles.badge(c.color, c.bg)}>{level}</span>
}

const TrendIcon = ({ trend }: { trend: 'up' | 'down' | 'stable' }) => {
  if (trend === 'up') return <TrendingUp size={14} color={COLORS.success} />
  if (trend === 'down') return <TrendingDown size={14} color={COLORS.danger} />
  return <Activity size={14} color={COLORS.textMuted} />
}

const SyncStatusIcon = ({ status }: { status: SyncStatus }) => {
  if (status === '已同步') return <Wifi size={16} color={COLORS.success} />
  if (status === '同步中') return <SyncIcon size={16} color={COLORS.primary} className="animate-spin" />
  if (status === '失败') return <WifiOff size={16} color={COLORS.danger} />
  return <ClockIcon size={16} color={COLORS.warning} />
}

const SystemTypeBadge = ({ type }: { type: SyncRecord['systemType'] }) => {
  const config: Record<string, { color: string; bg: string }> = {
    'HIS': { color: COLORS.his, bg: '#3b82f622' },
    'PACS': { color: COLORS.pacs, bg: COLORS.purpleLight },
    'EMR': { color: COLORS.emr, bg: COLORS.successLight },
    'LIS': { color: COLORS.lis, bg: COLORS.orangeLight },
    'RIS': { color: COLORS.ris, bg: COLORS.cyanLight },
  }
  const c = config[type] || { color: COLORS.textMuted, bg: COLORS.bgGray }
  return <span style={styles.badge(c.color, c.bg)}>{type}</span>
}

const DataSourceBadge = ({ source }: { source: DataSource }) => {
  const config: Record<DataSource, { color: string; bg: string }> = {
    'HIS': { color: COLORS.his, bg: '#3b82f622' },
    'PACS': { color: COLORS.pacs, bg: COLORS.purpleLight },
    'EMR': { color: COLORS.emr, bg: COLORS.successLight },
    'LIS': { color: COLORS.lis, bg: COLORS.orangeLight },
    'RIS': { color: COLORS.ris, bg: COLORS.cyanLight },
  }
  const c = config[source] || { color: COLORS.textMuted, bg: COLORS.bgGray }
  return <span style={styles.badge(c.color, c.bg)}>{source}</span>
}

const TimelineIcon = ({ type }: { type: TimelineEvent['type'] }) => {
  const config: Record<TimelineEvent['type'], { icon: React.ReactNode; color: string; bg: string }> = {
    'diagnosis': { icon: <Stethoscope size={14} />, color: COLORS.purple, bg: COLORS.purpleLight },
    'lab': { icon: <Droplet size={14} />, color: COLORS.orange, bg: COLORS.orangeLight },
    'medication': { icon: <Activity size={14} />, color: COLORS.success, bg: COLORS.successLight },
    'imaging': { icon: <Image size={14} />, color: COLORS.cyan, bg: COLORS.cyanLight },
    'vital': { icon: <Heart size={14} />, color: COLORS.danger, bg: COLORS.dangerLight },
  }
  const c = config[type]
  return (
    <div style={{
      width: '28px',
      height: '28px',
      borderRadius: '50%',
      backgroundColor: c.bg,
      color: c.color,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      {c.icon}
    </div>
  )
}

const ConnectionStatusIndicator = ({ status }: { status: SystemConnectionStatus['status'] }) => {
  const config: Record<SystemConnectionStatus['status'], { color: string; bg: string; label: string }> = {
    'online': { color: COLORS.success, bg: COLORS.successLight, label: t('clinicalData.statusOnline') },
    'offline': { color: COLORS.danger, bg: COLORS.dangerLight, label: t('clinicalData.statusOffline') },
    'degraded': { color: COLORS.warning, bg: COLORS.warningLight, label: t('clinicalData.statusDegraded') },
  }
  const c = config[status]
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
    }}>
      <div style={{
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        backgroundColor: c.color,
        animation: status === 'online' ? 'none' : status === 'degraded' ? 'pulse 1.5s infinite' : 'none',
      }} />
      <span style={{ fontSize: '12px', color: c.color }}>{c.label}</span>
    </div>
  )
}

// ==================== 患者360视图组件 ====================
// [G005 Wave4A P1] 患者列表真实化: patientApi.list 优先, 失败回退本地 initialPatients (演示徽标)
interface PatientListRow {
  id: string
  name: string
  gender: string
  age: number
  phone?: string
  patientType: string
}

const Patient360View = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedPatient, setSelectedPatient] = useState<Patient360Data | null>(null)
  const [patientTypeFilter, setPatientTypeFilter] = useState('全部')
  const [dateRange, setDateRange] = useState({ from: '', to: '' })
  const [activePatientTab, setActivePatientTab] = useState('overview')
  const [timelineView, setTimelineView] = useState<'vertical' | 'horizontal'>('vertical')
  const [apiPatients, setApiPatients] = useState<PatientListRow[]>([])
  const [patientsMode, setPatientsMode] = useState<'real' | 'demo'>('demo')

  // [G005 Wave4A P1] 真实重拉患者列表 (不再随机生成)
  const loadPatients = useCallback(async () => {
    try {
      const res = await patientApi.list({ skip: 0, take: 200 })
      const raw: any = res.data
      const rows = Array.isArray(raw)
        ? raw
        : raw && Array.isArray(raw.items) ? raw.items : []
      if (rows.length > 0) {
        setApiPatients(rows.map((p: any) => ({
          id: p.id ?? '',
          name: p.name ?? '未知',
          gender: p.gender ?? '未知',
          age: typeof p.age === 'number' ? p.age : 0,
          phone: p.phone ?? undefined,
          patientType: p.patientType ?? p.type ?? '门诊',
        })))
        setPatientsMode('real')
        return
      }
      setPatientsMode('demo')
    } catch {
      setPatientsMode('demo')
    }
  }, [])

  useEffect(() => { void loadPatients() }, [loadPatients])

  const patientSource: PatientListRow[] = apiPatients.length > 0 ? apiPatients : (initialPatients as unknown as PatientListRow[])

  const filteredPatients = useMemo(() => {
    return patientSource.filter(p => {
      const matchSearch = !searchTerm ||
        p.name.includes(searchTerm) ||
        p.id.includes(searchTerm) ||
        (p.phone || '').includes(searchTerm)
      const matchType = patientTypeFilter === '全部' || p.patientType === patientTypeFilter
      return matchSearch && matchType
    })
  }, [patientSource, searchTerm, patientTypeFilter])

  const patientStats = useMemo(() => ({
    totalPatients: patientSource.length,
    activePatients: patientSource.filter(p => {
      const lastExam = initialRadiologyExams.find(e => e.patientId === p.id)
      return lastExam && (Date.now() - new Date(lastExam.examDate).getTime()) < 30 * 86400000
    }).length,
    newThisMonth: patientSource.filter(p => {
      const lastExam = initialRadiologyExams.find(e => e.patientId === p.id)
      return lastExam && (Date.now() - new Date(lastExam.examDate).getTime()) < 30 * 86400000
    }).length,
    criticalCases: initialRadiologyExams.filter(e => e.criticalFinding).length,
  }), [patientSource])
  
  const patientData = selectedPatient ? generatePatient360(selectedPatient.patientId) : null
  const timelineEvents = patientData ? generateTimelineEvents(patientData) : []
  
  // Get latest vitals for key indicators
  const latestVitals = patientData?.vitals[0]
  
  return (
    <div>
      {/* 统计卡片 */}
      <div style={styles.statGrid}>
        <div style={styles.statCard(COLORS.primary, '#eff6ff')}>
          <div style={styles.statIcon(COLORS.primary)}>
            <Users size={20} />
          </div>
          <div>
            <div style={styles.statValue}>{patientStats.totalPatients}</div>
            <div style={styles.statLabel}>{t('clinicalData.totalPatients')}</div>
          </div>
        </div>
        <div style={styles.statCard(COLORS.success, COLORS.successLight)}>
          <div style={styles.statIcon(COLORS.success)}>
            <UserCheck size={20} />
          </div>
          <div>
            <div style={styles.statValue}>{patientStats.activePatients}</div>
            <div style={styles.statLabel}>{t('clinicalData.activePatients')}</div>
          </div>
        </div>
        <div style={styles.statCard(COLORS.secondary, COLORS.cyanLight)}>
          <div style={styles.statIcon(COLORS.secondary)}>
            <PlusCircle size={20} />
          </div>
          <div>
            <div style={styles.statValue}>{patientStats.newThisMonth}</div>
            <div style={styles.statLabel}>{t('clinicalData.newThisMonth')}</div>
          </div>
        </div>
        <div style={styles.statCard(COLORS.danger, COLORS.dangerLight)}>
          <div style={styles.statIcon(COLORS.danger)}>
            <AlertTriangle size={20} />
          </div>
          <div>
            <div style={styles.statValue}>{patientStats.criticalCases}</div>
            <div style={styles.statLabel}>{t('clinicalData.criticalCases')}</div>
          </div>
        </div>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: selectedPatient ? '1fr 1.5fr' : '1fr', gap: '16px' }}>
        {/* 左侧患者列表 */}
        <div style={styles.card}>
          <div style={{ ...styles.cardTitle, marginBottom: '12px' }}>
            <User size={18} color={COLORS.primary} />
            {t('clinicalData.patientList')}
            {/* [G005 Wave4A P1] 数据源徽标 */}
            <span style={{
              marginLeft: 'auto',
              ...styles.badge(
                patientsMode === 'real' ? COLORS.success : COLORS.warning,
                patientsMode === 'real' ? COLORS.successLight : COLORS.warningLight
              ),
            }}>
              {patientsMode === 'real' ? t('clinicalData.realData') : t('clinicalData.demoData')}
            </span>
          </div>
          
          {/* 搜索过滤 */}
          <div style={styles.searchBar}>
            <input
              style={styles.searchInput}
              placeholder={t('clinicalData.searchPatientPlaceholder')}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
            <select 
              style={styles.select}
              value={patientTypeFilter}
              onChange={e => setPatientTypeFilter(e.target.value)}
            >
              <option value="全部">{t('clinicalData.allTypes')}</option>
              <option value="门诊">{t('clinicalData.outpatient')}</option>
              <option value="住院">{t('clinicalData.inpatient')}</option>
              <option value="体检">{t('clinicalData.physicalExam')}</option>
              <option value="急诊">{t('clinicalData.emergency')}</option>
            </select>
          </div>
          
          {/* 患者列表 */}
          <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
            {filteredPatients.slice(0, 20).map(patient => {
              const pData = generatePatient360(patient.id)
              const isSelected = selectedPatient?.patientId === patient.id
              return (
                <div
                  key={patient.id}
                  onClick={() => setSelectedPatient(patient)}
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    marginBottom: '8px',
                    cursor: 'pointer',
                    backgroundColor: isSelected ? '#eff6ff' : 'transparent',
                    border: `1px solid ${isSelected ? COLORS.primary : 'transparent'}`,
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={styles.avatar(COLORS.primary)}>
                      {patient.name.charAt(0)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, marginBottom: '4px' }}>{patient.name}</div>
                      <div style={{ fontSize: '12px', color: COLORS.textMuted }}>
                        ID: {patient.id} | {patient.patientType} | {t('clinicalData.visitsCount', { count: pData.totalVisits })}
                      </div>
                    </div>
                    <ChevronRight size={16} color={COLORS.textMuted} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        
        {/* 右侧患者详情 */}
        {patientData && (
          <div style={styles.card}>
            <div style={{ ...styles.cardTitle, marginBottom: '16px' }}>
              <Eye size={18} color={COLORS.primary} />
              {t('clinicalData.patient360View')}
              <span style={{ marginLeft: '8px', fontSize: '12px', color: COLORS.textMuted }}>
                {patientData.name} - {patientData.patientId}
              </span>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                {patientData.diagnoses?.[0]?.source && <DataSourceBadge source={patientData.diagnoses[0]?.source} />}
                {patientData.exams?.[0]?.source && <DataSourceBadge source={patientData.exams[0]?.source} />}
                {patientData.labResults?.[0]?.source && <DataSourceBadge source={patientData.labResults[0]?.source} />}
                {patientData.medications?.[0]?.source && <DataSourceBadge source={patientData.medications[0]?.source} />}
              </div>
            </div>
            
            {/* 关键指标卡片 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' }}>
              <div style={{ padding: '12px', backgroundColor: COLORS.dangerLight, borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: COLORS.textMuted, marginBottom: '4px' }}>{t('clinicalData.latestBp')}</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: COLORS.danger }}>{latestVitals?.bp || '--'}</div>
                <div style={{ fontSize: '10px', color: COLORS.textMuted, marginTop: '2px' }}>mmHg</div>
              </div>
              <div style={{ padding: '12px', backgroundColor: COLORS.pinkLight, borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: COLORS.textMuted, marginBottom: '4px' }}>{t('clinicalData.latestHr')}</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: COLORS.pink }}>{latestVitals?.hr || '--'}</div>
                <div style={{ fontSize: '10px', color: COLORS.textMuted, marginTop: '2px' }}>bpm</div>
              </div>
              <div style={{ padding: '12px', backgroundColor: COLORS.cyanLight, borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: COLORS.textMuted, marginBottom: '4px' }}>{t('clinicalData.weight')}</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: COLORS.cyan }}>{latestVitals?.weight || '--'}</div>
                <div style={{ fontSize: '10px', color: COLORS.textMuted, marginTop: '2px' }}>kg</div>
              </div>
              <div style={{ padding: '12px', backgroundColor: COLORS.warningLight, borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: COLORS.textMuted, marginBottom: '4px' }}>{t('clinicalData.allergyHistory')}</div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: COLORS.warning }}>{t('clinicalData.allergyCount', { count: patientData.allergyHistory.length })}</div>
                <div style={{ fontSize: '10px', color: COLORS.textMuted, marginTop: '2px' }}>{patientData.allergyHistory.join(', ')}</div>
              </div>
            </div>
            
            {/* 患者概览 */}
            <div style={{ ...styles.grid2, marginBottom: '16px' }}>
              <div style={{ padding: '12px', backgroundColor: COLORS.bgGray, borderRadius: '8px' }}>
                <div style={{ fontSize: '12px', color: COLORS.textMuted, marginBottom: '4px' }}>{t('clinicalData.name')}</div>
                <div style={{ fontWeight: 600 }}>{patientData.name}</div>
              </div>
              <div style={{ padding: '12px', backgroundColor: COLORS.bgGray, borderRadius: '8px' }}>
                <div style={{ fontSize: '12px', color: COLORS.textMuted, marginBottom: '4px' }}>{t('clinicalData.genderAge')}</div>
                <div style={{ fontWeight: 600 }}>{patientData.gender} / {t('clinicalData.yearsOld', { age: patientData.age })}</div>
              </div>
              <div style={{ padding: '12px', backgroundColor: COLORS.bgGray, borderRadius: '8px' }}>
                <div style={{ fontSize: '12px', color: COLORS.textMuted, marginBottom: '4px' }}>{t('clinicalData.phone')}</div>
                <div style={{ fontWeight: 600 }}>{patientData.phone}</div>
              </div>
              <div style={{ padding: '12px', backgroundColor: COLORS.bgGray, borderRadius: '8px' }}>
                <div style={{ fontSize: '12px', color: COLORS.textMuted, marginBottom: '4px' }}>{t('clinicalData.patientType')}</div>
                <div style={{ fontWeight: 600 }}>{patientData.patientType}</div>
              </div>
            </div>
            
            {/* 数据来源标签 */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', color: COLORS.textMuted, marginBottom: '8px' }}>{t('clinicalData.dataSources')}</div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {['HIS', 'LIS', 'RIS', 'PACS', 'EMR'].map(src => (
                  <div key={src} style={{
                    padding: '4px 12px',
                    backgroundColor: COLORS.bgGray,
                    borderRadius: '12px',
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}>
                    <div style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      backgroundColor: src === 'HIS' ? COLORS.his : src === 'LIS' ? COLORS.lis : src === 'RIS' ? COLORS.ris : src === 'PACS' ? COLORS.pacs : COLORS.emr,
                    }} />
                    {src}
                  </div>
                ))}
              </div>
            </div>
            
            {/* 标签页 */}
            <div style={{
              display: 'flex',
              gap: '4px',
              backgroundColor: COLORS.bgGray,
              padding: '4px',
              borderRadius: '8px',
              marginBottom: '16px',
            }}>
              {[
                { key: 'overview', label: t('clinicalData.overview') },
                { key: 'timeline', label: t('clinicalData.clinicalTimeline') },
                { key: 'exams', label: t('clinicalData.exams') },
                { key: 'diagnoses', label: t('clinicalData.diagnoses') },
                { key: 'vitals', label: t('clinicalData.vitals') },
                { key: 'medications', label: t('clinicalData.medications') },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActivePatientTab(tab.key)}
                  style={{
                    flex: 1,
                    padding: '8px',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '12px',
                    cursor: 'pointer',
                    backgroundColor: activePatientTab === tab.key ? COLORS.primary : 'transparent',
                    color: activePatientTab === tab.key ? '#fff' : COLORS.textMuted,
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            
            {/* 内容区 */}
            {activePatientTab === 'overview' && (
              <div>
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontWeight: 600, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertTriangle size={14} color={COLORS.warning} />
                    {t('clinicalData.allergyHistory')}
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {patientData.allergyHistory.map(a => (
                      <span key={a} style={styles.badge(COLORS.warning, COLORS.warningLight)}>{a}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: '8px' }}>{t('clinicalData.recentDiagnoses')}</div>
                  {patientData.diagnoses.slice(0, 2).map((d, i) => (
                    <div key={i} style={{
                      padding: '10px',
                      backgroundColor: COLORS.bgGray,
                      borderRadius: '6px',
                      marginBottom: '8px',
                      fontSize: '13px',
                    }}>
                      <div style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {d.diagnosis}
                        <DataSourceBadge source={d.source} />
                      </div>
                      <div style={{ fontSize: '11px', color: COLORS.textMuted, marginTop: '4px' }}>
                        {d.date} | {d.doctor}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {activePatientTab === 'timeline' && (
              <div>
                <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '13px', color: COLORS.textMuted }}>
                    {t('clinicalData.timelineCount', { count: timelineEvents.length })}
                  </div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      onClick={() => setTimelineView('vertical')}
                      style={{
                        padding: '4px 8px',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '11px',
                        cursor: 'pointer',
                        backgroundColor: timelineView === 'vertical' ? COLORS.primary : COLORS.bgGray,
                        color: timelineView === 'vertical' ? '#fff' : COLORS.textMuted,
                      }}
                    >
                      {t('clinicalData.vertical')}
                    </button>
                    <button
                      onClick={() => setTimelineView('horizontal')}
                      style={{
                        padding: '4px 8px',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '11px',
                        cursor: 'pointer',
                        backgroundColor: timelineView === 'horizontal' ? COLORS.primary : COLORS.bgGray,
                        color: timelineView === 'horizontal' ? '#fff' : COLORS.textMuted,
                      }}
                    >
                      {t('clinicalData.horizontal')}
                    </button>
                  </div>
                </div>
                
                {/* 临床时间线 */}
                <div style={{ 
                  maxHeight: '400px', 
                  overflowY: 'auto',
                  paddingLeft: '8px',
                }}>
                  {timelineEvents.map((event, index) => (
                    <div key={event.id} style={{
                      display: 'flex',
                      gap: '12px',
                      marginBottom: '16px',
                      position: 'relative',
                    }}>
                      {/* 时间线连接线 */}
                      {index < timelineEvents.length - 1 && (
                        <div style={{
                          position: 'absolute',
                          left: '14px',
                          top: '28px',
                          width: '2px',
                          height: 'calc(100% + 16px)',
                          backgroundColor: COLORS.border,
                        }} />
                      )}
                      
                      {/* 图标 */}
                      <div style={{ position: 'relative', zIndex: 1 }}>
                        <TimelineIcon type={event.type} />
                      </div>
                      
                      {/* 内容 */}
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <span style={{ fontWeight: 600, fontSize: '13px' }}>{event.title}</span>
                          <DataSourceBadge source={event.source} />
                        </div>
                        <div style={{ fontSize: '12px', color: COLORS.textMuted, marginBottom: '4px' }}>
                          {event.description}
                        </div>
                        <div style={{ fontSize: '11px', color: COLORS.textMuted }}>
                          {event.date}
                          {event.doctor && ` | ${event.doctor}`}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {activePatientTab === 'exams' && (
              <div>
                {patientData.exams.map(exam => (
                  <div key={exam.id} style={{
                    padding: '12px',
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: '8px',
                    marginBottom: '8px',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontWeight: 600 }}>{exam.examType}</span>
                      <span style={styles.badge(COLORS.secondary, COLORS.cyanLight)}>{exam.modality}</span>
                    </div>
                    <div style={{ fontSize: '12px', color: COLORS.textMuted }}>{t('clinicalData.examDate', { date: exam.date })}</div>
                    <div style={{ fontSize: '13px', marginTop: '6px' }}>{exam.result}</div>
                  </div>
                ))}
              </div>
            )}
            
            {activePatientTab === 'diagnoses' && (
              <div>
                {patientData.diagnoses.map((d, i) => (
                  <div key={i} style={{
                    padding: '12px',
                    backgroundColor: COLORS.bgGray,
                    borderRadius: '8px',
                    marginBottom: '8px',
                  }}>
                    <div style={{ fontWeight: 600, marginBottom: '4px' }}>{d.diagnosis}</div>
                    <div style={{ fontSize: '12px', color: COLORS.textMuted }}>
                      {d.date} | {d.doctor}
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {activePatientTab === 'vitals' && (
              <div>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>{t('clinicalData.thDate')}</th>
                      <th style={styles.th}>{t('clinicalData.thBp')}</th>
                      <th style={styles.th}>{t('clinicalData.thHr')}</th>
                      <th style={styles.th}>{t('clinicalData.thTemp')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {patientData.vitals.map((v, i) => (
                      <tr key={i}>
                        <td style={styles.td}>{v.date}</td>
                        <td style={styles.td}>{v.bp}</td>
                        <td style={styles.td}>{v.hr} bpm</td>
                        <td style={styles.td}>{v.temp}°C</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            
            {activePatientTab === 'medications' && (
              <div>
                {patientData.medications.map((m, i) => (
                  <div key={i} style={{
                    padding: '12px',
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: '8px',
                    marginBottom: '8px',
                  }}>
                    <div style={{ fontWeight: 600, marginBottom: '4px' }}>{m.name}</div>
                    <div style={{ fontSize: '12px', color: COLORS.textMuted }}>
                      {m.dosage} | {m.frequency} | {t('clinicalData.medStart', { date: m.startDate })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ==================== 跨系统数据同步组件 ====================
const CrossSystemSync = () => {
  const [syncRecords, setSyncRecords] = useState<SyncRecord[]>([])
  const [systemFilter, setSystemFilter] = useState('全部')
  const [statusFilter, setStatusFilter] = useState('全部')
  const [searchTerm, setSearchTerm] = useState('')
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [lastSyncTime, setLastSyncTime] = useState(new Date().toLocaleTimeString('zh-CN'))
  const [systemConnections, setSystemConnections] = useState<SystemConnectionStatus[]>(generateSystemConnectionStatus())

  // [G005 Wave4A P1] 同步记录改为持久化存储 (首次生成后不再随机重排, 刷新=真实重拉)
  const loadSyncRecords = useCallback(() => {
    const saved = (() => { try { return JSON.parse(localStorage.getItem('g005_clinical_sync_records') || '') } catch { return null } })()
    if (Array.isArray(saved) && saved.length > 0) {
      setSyncRecords(saved)
      return
    }
    const records = generateSyncRecords()
    try { localStorage.setItem('g005_clinical_sync_records', JSON.stringify(records)) } catch { }
    setSyncRecords(records)
  }, [])

  useEffect(() => {
    loadSyncRecords()
  }, [loadSyncRecords])
  
  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(() => {
      setSyncRecords(prev => prev.map(r => {
        if (r.status === '同步中') {
          const newStatus = Math.random() > 0.3 ? '已同步' : '失败'
          return { ...r, status: newStatus, errorMsg: newStatus === '失败' ? '连接超时' : undefined }
        }
        return r
      }))
      setLastSyncTime(new Date().toLocaleTimeString('zh-CN'))
      
      // Update system connections with simulated changes
      setSystemConnections(prev => prev.map(sys => ({
        ...sys,
        lastSyncTime: new Date(Date.now() - Math.random() * 300000).toLocaleTimeString('zh-CN'),
        errorCount: sys.status === 'degraded' ? sys.errorCount + Math.floor(Math.random() * 2) : sys.errorCount,
      })))
    }, 5000)
    return () => clearInterval(interval)
  }, [autoRefresh])
  
  const syncStats = useMemo(() => {
    const total = syncRecords.length
    const synced = syncRecords.filter(r => r.status === '已同步').length
    const failed = syncRecords.filter(r => r.status === '失败').length
    const syncing = syncRecords.filter(r => r.status === '同步中').length
    const pending = syncRecords.filter(r => r.status === '待同步').length
    return { total, synced, failed, syncing, pending, rate: total ? Math.round(synced / total * 100) : 0 }
  }, [syncRecords])
  
  const filteredRecords = useMemo(() => {
    return syncRecords.filter(r => {
      const matchSystem = systemFilter === '全部' || r.systemType === systemFilter
      const matchStatus = statusFilter === '全部' || r.status === statusFilter
      const matchSearch = !searchTerm || r.patientName.includes(searchTerm) || r.patientId.includes(searchTerm)
      return matchSystem && matchStatus && matchSearch
    })
  }, [syncRecords, systemFilter, statusFilter, searchTerm])
  
  // Calculate connection status stats
  const connectionStats = useMemo(() => {
    const online = systemConnections.filter(s => s.status === 'online').length
    const degraded = systemConnections.filter(s => s.status === 'degraded').length
    const offline = systemConnections.filter(s => s.status === 'offline').length
    const totalRecords = systemConnections.reduce((sum, s) => sum + s.recordCount, 0)
    const totalErrors = systemConnections.reduce((sum, s) => sum + s.errorCount, 0)
    return { online, degraded, offline, totalRecords, totalErrors }
  }, [systemConnections])
  
  const hasAlerts = systemConnections.some(s => s.status !== 'online' || s.alertMessage)
  
  return (
    <div>
      {/* 统计卡片 */}
      <div style={styles.statGrid}>
        <div style={styles.statCard(COLORS.primary, '#eff6ff')}>
          <div style={styles.statIcon(COLORS.primary)}>
            <Database size={20} />
          </div>
          <div>
            <div style={styles.statValue}>{syncStats.total}</div>
            <div style={styles.statLabel}>{t('clinicalData.syncTotal')}</div>
          </div>
        </div>
        <div style={styles.statCard(COLORS.success, COLORS.successLight)}>
          <div style={styles.statIcon(COLORS.success)}>
            <CheckCircle size={20} />
          </div>
          <div>
            <div style={styles.statValue}>{syncStats.synced}</div>
            <div style={styles.statLabel}>{t('clinicalData.synced')}</div>
          </div>
        </div>
        <div style={styles.statCard(COLORS.danger, COLORS.dangerLight)}>
          <div style={styles.statIcon(COLORS.danger)}>
            <AlertOctagon size={20} />
          </div>
          <div>
            <div style={styles.statValue}>{syncStats.failed}</div>
            <div style={styles.statLabel}>{t('clinicalData.syncFailed')}</div>
          </div>
        </div>
        <div style={styles.statCard(COLORS.secondary, COLORS.cyanLight)}>
          <div style={styles.statIcon(COLORS.secondary)}>
            <SyncIcon size={20} />
          </div>
          <div>
            <div style={styles.statValue}>{syncStats.rate}%</div>
            <div style={styles.statLabel}>{t('clinicalData.syncRate')}</div>
          </div>
        </div>
      </div>
      
      {/* 系统连接状态 - 增强版 */}
      <div style={styles.card}>
        <div style={{ ...styles.cardTitle, marginBottom: '16px' }}>
          <Server size={18} color={COLORS.primary} />
          {t('clinicalData.syncMonitor')}
          {/* [G005 Wave4A P1] 演示数据徽标 (本区块为本地模拟同步, 未接真实集成) */}
          <span style={styles.badge(COLORS.warning, COLORS.warningLight)}>{t('clinicalData.demoData')}</span>
          {hasAlerts && (
            <span style={{
              marginLeft: '12px',
              padding: '4px 10px',
              backgroundColor: COLORS.dangerLight,
              color: COLORS.danger,
              borderRadius: '12px',
              fontSize: '12px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}>
              <AlertTriangle size={14} />
              {t('clinicalData.abnormalCount', { count: systemConnections.filter(s => s.status !== 'online').length })}
            </span>
          )}
          <span style={{ marginLeft: 'auto', fontSize: '12px', color: COLORS.textMuted }}>
            {t('clinicalData.lastRefresh', { time: lastSyncTime })}
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              style={{
                marginLeft: '12px',
                padding: '4px 8px',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '11px',
                backgroundColor: autoRefresh ? COLORS.successLight : COLORS.bgGray,
                color: autoRefresh ? COLORS.success : COLORS.textMuted,
              }}
            >
              {autoRefresh ? t('clinicalData.autoRefreshing') : t('clinicalData.paused')}
            </button>
          </span>
        </div>
        
        {/* 连接状态总览 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' }}>
          <div style={{ padding: '12px', backgroundColor: COLORS.successLight, borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '11px', color: COLORS.textMuted, marginBottom: '4px' }}>{t('clinicalData.onlineSystems')}</div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: COLORS.success }}>{connectionStats.online}</div>
            <div style={{ fontSize: '10px', color: COLORS.textMuted, marginTop: '2px' }}>{t('clinicalData.ofTotal', { count: systemConnections.length })}</div>
          </div>
          <div style={{ padding: '12px', backgroundColor: COLORS.warningLight, borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '11px', color: COLORS.textMuted, marginBottom: '4px' }}>{t('clinicalData.degradedSystems')}</div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: COLORS.warning }}>{connectionStats.degraded}</div>
            <div style={{ fontSize: '10px', color: COLORS.textMuted, marginTop: '2px' }}>{t('clinicalData.needAttention')}</div>
          </div>
          <div style={{ padding: '12px', backgroundColor: COLORS.dangerLight, borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '11px', color: COLORS.textMuted, marginBottom: '4px' }}>{t('clinicalData.offlineSystems')}</div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: COLORS.danger }}>{connectionStats.offline}</div>
            <div style={{ fontSize: '10px', color: COLORS.textMuted, marginTop: '2px' }}>{t('clinicalData.needAction')}</div>
          </div>
          <div style={{ padding: '12px', backgroundColor: 'var(--color-info-bg)', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '11px', color: COLORS.textMuted, marginBottom: '4px' }}>{t('clinicalData.syncRecords')}</div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: COLORS.primary }}>{connectionStats.totalRecords.toLocaleString()}</div>
            <div style={{ fontSize: '10px', color: connectionStats.totalErrors > 0 ? COLORS.danger : COLORS.textMuted, marginTop: '2px' }}>
              {t('clinicalData.errorCount', { count: connectionStats.totalErrors })}
            </div>
          </div>
        </div>
        
        {/* 系统连接卡片 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' }}>
          {systemConnections.map(sys => (
            <div key={sys.type} style={{
              padding: '16px',
              backgroundColor: sys.status === 'online' ? COLORS.successLight : sys.status === 'degraded' ? COLORS.warningLight : COLORS.dangerLight,
              borderRadius: '10px',
              border: sys.alertMessage ? `2px solid ${COLORS.danger}` : 'none',
            }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: sys.status === 'online' ? COLORS.success : sys.status === 'degraded' ? COLORS.warning : COLORS.danger,
                margin: '0 auto 8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Server size={16} color="#fff" />
              </div>
              <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '4px', textAlign: 'center' }}>{sys.type}</div>
              <div style={{ fontSize: '11px', color: COLORS.textMuted, marginBottom: '8px', textAlign: 'center' }}>{sys.name}</div>
              <div style={{ marginBottom: '8px' }}>
                <ConnectionStatusIndicator status={sys.status} />
              </div>
              <div style={{ fontSize: '11px', color: COLORS.textMuted, marginBottom: '4px', textAlign: 'center' }}>
                {t('clinicalData.lastSync', { time: sys.lastSyncTime })}
              </div>
              <div style={{ fontSize: '11px', color: COLORS.textMuted, marginBottom: '8px', textAlign: 'center' }}>
                {t('clinicalData.recordCount', { count: sys.recordCount.toLocaleString() })}
                {sys.errorCount > 0 && (
                  <span style={{ color: COLORS.danger, marginLeft: '4px' }}>
                    {t('clinicalData.errorSuffix', { count: sys.errorCount })}
                  </span>
                )}
              </div>
              {sys.alertMessage && (
                <div style={{
                  fontSize: '10px',
                  color: COLORS.danger,
                  backgroundColor: COLORS.dangerLight,
                  padding: '4px 6px',
                  borderRadius: '4px',
                  textAlign: 'center',
                  marginTop: '4px',
                }}>
                  {sys.alertMessage}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      
      {/* 同步记录 */}
      <div style={styles.card}>
        <div style={{ ...styles.cardTitle, marginBottom: '12px' }}>
          <Network size={18} color={COLORS.primary} />
          {t('clinicalData.syncRecords')}
          <span style={{ marginLeft: 'auto', ...styles.badge(COLORS.warning, COLORS.warningLight) }}>{t('clinicalData.demoData')}</span>
        </div>
        
        <div style={styles.searchBar}>
          <input
            style={styles.searchInput}
            placeholder={t('clinicalData.searchPatientIdPlaceholder')}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
          <select style={styles.select} value={systemFilter} onChange={e => setSystemFilter(e.target.value)}>
            <option value="全部">{t('clinicalData.allSystems')}</option>
            <option value="HIS">HIS</option>
            <option value="PACS">PACS</option>
            <option value="EMR">EMR</option>
            <option value="LIS">LIS</option>
            <option value="RIS">RIS</option>
          </select>
          <select style={styles.select} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="全部">{t('clinicalData.allStatus')}</option>
            <option value="已同步">{t('clinicalData.synced')}</option>
            <option value="同步中">{t('clinicalData.syncing')}</option>
            <option value="失败">{t('clinicalData.failed')}</option>
            <option value="待同步">{t('clinicalData.pending')}</option>
          </select>
          <button style={styles.btnOutline(COLORS.primary)} onClick={() => loadSyncRecords()}>
            <RefreshCw size={14} />
            {t('clinicalData.refresh')}
          </button>
        </div>
        
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>{t('clinicalData.thSystem')}</th>
              <th style={styles.th}>{t('clinicalData.thDataType')}</th>
              <th style={styles.th}>{t('clinicalData.thPatient')}</th>
              <th style={styles.th}>{t('clinicalData.thSyncTime')}</th>
              <th style={styles.th}>{t('clinicalData.thStatus')}</th>
              <th style={styles.th}>{t('clinicalData.thAction')}</th>
            </tr>
          </thead>
          <tbody>
            {filteredRecords.slice(0, 15).map(record => (
              <tr key={record.id}>
                <td style={styles.td}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <SyncStatusIcon status={record.status} />
                    <SystemTypeBadge type={record.systemType} />
                  </div>
                </td>
                <td style={styles.td}>{record.recordType}</td>
                <td style={styles.td}>
                  <div style={{ fontWeight: 500 }}>{record.patientName}</div>
                  <div style={{ fontSize: '11px', color: COLORS.textMuted }}>{record.patientId}</div>
                </td>
                <td style={styles.td}>{record.syncTime}</td>
                <td style={styles.td}>
                  <StatusBadge status={record.status} />
                  {record.errorMsg && (
                    <div style={{ fontSize: '11px', color: COLORS.danger, marginTop: '4px' }}>
                      {record.errorMsg}
                    </div>
                  )}
                </td>
                <td style={styles.td}>
                  {record.status === '失败' && (
                    <button style={styles.btn(COLORS.primary)} onClick={async (evt) => {
                      const btn = (evt?.target || evt?.currentTarget) as HTMLButtonElement;
                      const orig = btn.innerHTML;
                      btn.innerHTML = t('clinicalData.retrying');
                      btn.disabled = true;
                      await new Promise(r => setTimeout(r, 1500));
                      setSyncRecords(prev => {
                        const next = prev.map(s => s.id === record.id ? { ...s, status: '同步中' as SyncStatus, errorMsg: undefined } : s)
                        try { localStorage.setItem('g005_clinical_sync_records', JSON.stringify(next)) } catch { }
                        return next
                      })
                      btn.innerHTML = t('clinicalData.retried');
                      setTimeout(() => { btn.innerHTML = orig; btn.disabled = false; }, 2000);
                    }}>
                      <RefreshCw size={14} />
                      {t('clinicalData.retry')}
                    </button>
                  )}
                  {record.status === '同步中' && (
                    <button style={styles.btnOutline(COLORS.warning)} onClick={async (evt) => {
                      const btn = (evt?.target || evt?.currentTarget) as HTMLButtonElement;
                      const orig = btn.innerHTML;
                      btn.innerHTML = t('clinicalData.pausing');
                      btn.disabled = true;
                      await new Promise(r => setTimeout(r, 1500));
                      setSyncRecords(prev => {
                        const next = prev.map(s => s.id === record.id ? { ...s, status: '待同步' as SyncStatus, errorMsg: undefined } : s)
                        try { localStorage.setItem('g005_clinical_sync_records', JSON.stringify(next)) } catch { }
                        return next
                      })
                      btn.innerHTML = t('clinicalData.pausedDone');
                      setTimeout(() => { btn.innerHTML = orig; btn.disabled = false; }, 2000);
                    }}>
                      <Pause size={14} />
                      {t('clinicalData.pause')}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ==================== 数据质量监控组件 ====================
const DataQualityMonitor = () => {
  const [qualityMetrics, setQualityMetrics] = useState<QualityMetric[]>([])
  const [categoryFilter, setCategoryFilter] = useState('全部')
  const [levelFilter, setLevelFilter] = useState('全部')

  // [G005 Wave4A P1] 质量指标持久化存储: 首次生成后不再随机重排, 刷新=真实重拉
  const loadQualityMetrics = useCallback(() => {
    const saved = (() => { try { return JSON.parse(localStorage.getItem('g005_clinical_quality_metrics') || '') } catch { return null } })()
    if (Array.isArray(saved) && saved.length > 0) {
      setQualityMetrics(saved)
      return
    }
    const metrics = generateQualityMetrics()
    try { localStorage.setItem('g005_clinical_quality_metrics', JSON.stringify(metrics)) } catch { }
    setQualityMetrics(metrics)
  }, [])

  useEffect(() => {
    loadQualityMetrics()
  }, [loadQualityMetrics])
  
  const qualityDimensions = useMemo(() => generateQualityDimensions(), [])
  
  const categoryStats = useMemo(() => {
    const categories = [...new Set(qualityMetrics.map(m => m.category))]
    return categories.map(cat => {
      const catMetrics = qualityMetrics.filter(m => m.category === cat)
      const avgScore = catMetrics.reduce((sum, m) => sum + m.score, 0) / catMetrics.length
      const issueCount = catMetrics.reduce((sum, m) => sum + m.issueCount, 0)
      return { category: cat, avgScore: Math.round(avgScore * 10) / 10, issueCount, metricCount: catMetrics.length }
    })
  }, [qualityMetrics])
  
  const overallScore = useMemo(() => {
    if (!qualityMetrics.length) return 0
    return Math.round(qualityMetrics.reduce((sum, m) => sum + m.score, 0) / qualityMetrics.length * 10) / 10
  }, [qualityMetrics])
  
  const levelCounts = useMemo(() => ({
    excellent: qualityMetrics.filter(m => m.level === '优').length,
    good: qualityMetrics.filter(m => m.level === '良').length,
    medium: qualityMetrics.filter(m => m.level === '中').length,
    poor: qualityMetrics.filter(m => m.level === '差').length,
  }), [qualityMetrics])
  
  const filteredMetrics = useMemo(() => {
    return qualityMetrics.filter(m => {
      const matchCat = categoryFilter === '全部' || m.category === categoryFilter
      const matchLevel = levelFilter === '全部' || m.level === levelFilter
      return matchCat && matchLevel
    })
  }, [qualityMetrics, categoryFilter, levelFilter])
  
  const pieData = [
    { name: '优', value: levelCounts.excellent, color: COLORS.success },
    { name: '良', value: levelCounts.good, color: COLORS.primaryLight },
    { name: '中', value: levelCounts.medium, color: COLORS.warning },
    { name: '差', value: levelCounts.poor, color: COLORS.danger },
  ]
  
  const radarData = categoryStats.map(c => ({
    category: c.category,
    score: c.avgScore,
    fullMark: 100,
  }))
  
  // Quality dimension card colors
  const dimensionColors: Record<string, { color: string; bg: string; light: string }> = {
    '完整性': { color: COLORS.success, bg: COLORS.successLight, light: '#dcfce7' },
    '及时性': { color: COLORS.warning, bg: COLORS.warningLight, light: '#fef3c7' },
    '准确性': { color: COLORS.primary, bg: '#3b82f622', light: '#dbeafe' },
    '一致性': { color: COLORS.purple, bg: COLORS.purpleLight, light: '#ede9fe' },
  }
  
  return (
    <div>
      {/* 四维度质量评分卡 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '16px' }}>
        {qualityDimensions.map(dim => {
          const colors = dimensionColors[dim.dimension]
          return (
            <div key={dim.dimension} style={{
              padding: '20px',
              backgroundColor: colors.light,
              borderRadius: '12px',
              borderLeft: `4px solid ${colors.color}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: COLORS.textDark, marginBottom: '4px' }}>
                    {dim.dimension}
                  </div>
                  <div style={{ fontSize: '12px', color: COLORS.textMuted }}>
                    {dim.subDimension}
                  </div>
                </div>
                <div style={{
                  padding: '4px 10px',
                  backgroundColor: dim.score >= 95 ? COLORS.success : dim.score >= 90 ? COLORS.primaryLight : dim.score >= 85 ? COLORS.warning : COLORS.danger,
                  borderRadius: '12px',
                  color: '#fff',
                  fontSize: '12px',
                  fontWeight: 600,
                }}>
                  {dim.level}
                </div>
              </div>
              
              <div style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                  <span style={{ fontSize: '28px', fontWeight: 700, color: colors.color }}>
                    {dim.score}
                  </span>
                  <span style={{ fontSize: '14px', color: COLORS.textMuted }}>{t('clinicalData.scoreUnit')}</span>
                </div>
              </div>
              
              <div style={{
                width: '100%',
                height: '6px',
                backgroundColor: COLORS.bgGray,
                borderRadius: '3px',
                overflow: 'hidden',
                marginBottom: '12px',
              }}>
                <div style={{
                  width: `${dim.score}%`,
                  height: '100%',
                  backgroundColor: colors.color,
                  borderRadius: '3px',
                }} />
              </div>
              
              <div style={{ fontSize: '11px', color: COLORS.textMuted, marginBottom: '8px' }}>
                {dim.description}
              </div>
              
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {dim.metrics.map(m => (
                  <span key={m} style={{
                    padding: '2px 8px',
                    backgroundColor: COLORS.bgGray,
                    borderRadius: '8px',
                    fontSize: '10px',
                    color: COLORS.textMuted,
                  }}>
                    {m}
                  </span>
                ))}
              </div>
              
              <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <TrendIcon trend={dim.trend} />
                <span style={{ fontSize: '11px', color: COLORS.textMuted }}>
                  {dim.trend === 'up' ? t('clinicalData.trendUp') : dim.trend === 'down' ? t('clinicalData.trendDown') : t('clinicalData.trendStable')}
                </span>
              </div>
            </div>
          )
        })}
      </div>
      
      {/* 统计概览 */}
      <div style={styles.statGrid}>
        <div style={styles.statCard(COLORS.primary, '#eff6ff')}>
          <div style={styles.statIcon(COLORS.primary)}>
            <ShieldCheck size={20} />
          </div>
          <div>
            <div style={styles.statValue}>{overallScore}</div>
            <div style={styles.statLabel}>{t('clinicalData.overallScore')}</div>
          </div>
        </div>
        <div style={styles.statCard(COLORS.success, COLORS.successLight)}>
          <div style={styles.statIcon(COLORS.success)}>
            <CheckCircle size={20} />
          </div>
          <div>
            <div style={styles.statValue}>{levelCounts.excellent}</div>
            <div style={styles.statLabel}>{t('clinicalData.excellentMetrics')}</div>
          </div>
        </div>
        <div style={styles.statCard(COLORS.warning, COLORS.warningLight)}>
          <div style={styles.statIcon(COLORS.warning)}>
            <AlertCircle size={20} />
          </div>
          <div>
            <div style={styles.statValue}>{qualityMetrics.reduce((sum, m) => sum + m.issueCount, 0)}</div>
            <div style={styles.statLabel}>{t('clinicalData.pendingIssues')}</div>
          </div>
        </div>
        <div style={styles.statCard(COLORS.danger, COLORS.dangerLight)}>
          <div style={styles.statIcon(COLORS.danger)}>
            <AlertOctagon size={20} />
          </div>
          <div>
            <div style={styles.statValue}>{levelCounts.poor}</div>
            <div style={styles.statLabel}>{t('clinicalData.improveMetrics')}</div>
          </div>
        </div>
      </div>
      
      {/* 图表区域 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        {/* 质量分布饼图 */}
        <div style={styles.card}>
          <div style={styles.cardTitle}>
            <PieChartIcon size={18} color={COLORS.primary} />
            {t('clinicalData.qualityDistribution')}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            <div style={{ width: 180, height: 180, flexShrink: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            </div>
            <div style={{ flex: 1 }}>
              {pieData.map(item => (
                <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: item.color }} />
                  <span style={{ fontSize: '13px', width: '30px' }}>{item.name}</span>
                  <span style={{ fontSize: '13px', color: COLORS.textMuted }}>{t('clinicalData.itemsCount', { count: item.value })}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        {/* 雷达图 */}
        <div style={styles.card}>
          <div style={styles.cardTitle}>
            <BarChart2 size={18} color={COLORS.primary} />
            {t('clinicalData.categoryComparison')}
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <RadarChart data={radarData}>
              <PolarGrid stroke={COLORS.border} />
              <PolarAngleAxis dataKey="category" tick={{ fontSize: 12 }} />
              <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 12 }} />
              <Radar name={t('clinicalData.qualityScore')} dataKey="score" stroke={COLORS.primary} fill={COLORS.primary} fillOpacity={0.4} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      {/* 类别统计 */}
      <div style={styles.card}>
        <div style={{ ...styles.cardTitle, marginBottom: '16px' }}>
          <ActivityIcon size={18} color={COLORS.primary} />
          {t('clinicalData.categoryOverview')}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
          {categoryStats.map(cat => (
            <div key={cat.category} style={{
              padding: '16px',
              backgroundColor: COLORS.bgGray,
              borderRadius: '10px',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '12px', color: COLORS.textMuted, marginBottom: '8px' }}>{cat.category}</div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: cat.avgScore >= 95 ? COLORS.success : cat.avgScore >= 90 ? COLORS.primaryLight : cat.avgScore >= 85 ? COLORS.warning : COLORS.danger }}>
                {cat.avgScore}
              </div>
              <div style={{ fontSize: '11px', color: COLORS.textMuted, marginTop: '4px' }}>
                {t('clinicalData.issueCountSuffix', { count: cat.issueCount })}
              </div>
              <div style={{ marginTop: '8px' }}>
                <div style={{ ...styles.progress(100, ''), height: '4px' }}>
                  <div style={{ ...styles.progressBar(cat.avgScore, cat.avgScore >= 95 ? COLORS.success : cat.avgScore >= 90 ? COLORS.primaryLight : cat.avgScore >= 85 ? COLORS.warning : COLORS.danger), width: `${cat.avgScore}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* 质量指标明细 */}
      <div style={styles.card}>
        <div style={{ ...styles.cardTitle, marginBottom: '12px' }}>
          <LineChart size={18} color={COLORS.primary} />
          {t('clinicalData.metricDetails')}
          <span style={{ marginLeft: 'auto', ...styles.badge(COLORS.warning, COLORS.warningLight) }}>{t('clinicalData.demoData')}</span>
        </div>
        
        <div style={styles.searchBar}>
          <select style={styles.select} value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
            <option value="全部">{t('clinicalData.allCategories')}</option>
            <option value="数据完整性">{t('clinicalData.catCompleteness')}</option>
            <option value="数据准确性">{t('clinicalData.catAccuracy')}</option>
            <option value="数据时效性">{t('clinicalData.catTimeliness')}</option>
            <option value="数据一致性">{t('clinicalData.catConsistency')}</option>
            <option value="数据标准化">{t('clinicalData.catStandardization')}</option>
          </select>
          <select style={styles.select} value={levelFilter} onChange={e => setLevelFilter(e.target.value)}>
            <option value="全部">{t('clinicalData.allLevels')}</option>
            <option value="优">{t('clinicalData.qualityExcellent')}</option>
            <option value="良">{t('clinicalData.qualityGood')}</option>
            <option value="中">{t('clinicalData.qualityMedium')}</option>
            <option value="差">{t('clinicalData.qualityPoor')}</option>
          </select>
          <button style={styles.btnOutline(COLORS.primary)} onClick={() => loadQualityMetrics()}>
            <RefreshCw size={14} />
            {t('clinicalData.refresh')}
          </button>
        </div>
        
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>{t('clinicalData.thCategory')}</th>
              <th style={styles.th}>{t('clinicalData.thMetric')}</th>
              <th style={styles.th}>{t('clinicalData.thScore')}</th>
              <th style={styles.th}>{t('clinicalData.thLevel')}</th>
              <th style={styles.th}>{t('clinicalData.thTrend')}</th>
              <th style={styles.th}>{t('clinicalData.thIssues')}</th>
              <th style={styles.th}>{t('clinicalData.thQualityTrend')}</th>
            </tr>
          </thead>
          <tbody>
            {filteredMetrics.map((metric, i) => (
              <tr key={i}>
                <td style={styles.td}>
                  <span style={styles.badge(COLORS.primary, '#eff6ff')}>{metric.category}</span>
                </td>
                <td style={styles.td}>
                  <div style={{ fontWeight: 500 }}>{metric.metric}</div>
                  <div style={{ fontSize: '11px', color: COLORS.textMuted, marginTop: '2px' }}>{metric.description}</div>
                </td>
                <td style={styles.td}>
                  <span style={{ fontWeight: 700, fontSize: '16px', color: metric.score >= 95 ? COLORS.success : metric.score >= 90 ? COLORS.primaryLight : metric.score >= 85 ? COLORS.warning : COLORS.danger }}>
                    {metric.score}
                  </span>
                  <span style={{ fontSize: '11px', color: COLORS.textMuted }}>%</span>
                </td>
                <td style={styles.td}><QualityBadge level={metric.level} /></td>
                <td style={styles.td}><TrendIcon trend={metric.trend} /></td>
                <td style={styles.td}>
                  <span style={{ color: metric.issueCount > 20 ? COLORS.danger : metric.issueCount > 10 ? COLORS.warning : COLORS.success }}>
                    {metric.issueCount}
                  </span>
                </td>
                <td style={styles.td}>
                  <div style={{ width: '100px', display: 'flex', alignItems: 'center' }}>
                    <div style={{ ...styles.progress(100, ''), flex: 1 }}>
                      <div style={{ ...styles.progressBar(metric.score, metric.score >= 95 ? COLORS.success : metric.score >= 90 ? COLORS.primaryLight : metric.score >= 85 ? COLORS.warning : COLORS.danger), width: `${metric.score}%` }} />
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ==================== CDR搜索组件 ====================
const CDRSearchView = ({ onSelectPatient }: { onSelectPatient?: (patientId: string) => void }) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<CDRSearchResult[]>([])
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [isSearching, setIsSearching] = useState(false)
  
  useEffect(() => {
    // Load recent searches from localStorage
    const saved = localStorage.getItem('g005_cdr_recent_searches')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) setRecentSearches(parsed as string[])
      } catch { }
    }
  }, [])
  
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query)
    if (query.length < 2) {
      setSearchResults([])
      return
    }
    
    setIsSearching(true)
    // Simulate search delay
    setTimeout(() => {
      const results = searchCDRData(query)
      setSearchResults(results)
      setIsSearching(false)
      
      // Save to recent searches
      if (query.length >= 2) {
        const updated = [query, ...recentSearches.filter(s => s !== query)].slice(0, 5)
        setRecentSearches(updated)
        localStorage.setItem('g005_cdr_recent_searches', JSON.stringify(updated))
      }
    }, 300)
  }, [recentSearches])
  
  const clearRecentSearches = () => {
    setRecentSearches([])
    localStorage.removeItem('g005_cdr_recent_searches')
  }
  
  return (
    <div>
      {/* 搜索框 */}
      <div style={styles.card}>
        <div style={{ ...styles.cardTitle, marginBottom: '16px' }}>
          <Search size={18} color={COLORS.primary} />
          {t('clinicalData.cdrSearch')}
          <span style={{ marginLeft: '8px', fontSize: '12px', color: COLORS.textMuted }}>
            {t('clinicalData.cdrSearchDesc')}
          </span>
        </div>
        
        {/* 搜索输入框 */}
        <div style={{ position: 'relative', marginBottom: '16px' }}>
          <div style={{
            position: 'absolute',
            left: '14px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: COLORS.textMuted,
          }}>
            <Search size={18} />
          </div>
          <input
            style={{
              ...styles.input,
              paddingLeft: '44px',
              fontSize: '15px',
              height: '48px',
            }}
            placeholder={t('clinicalData.searchPlaceholder')}
            value={searchQuery}
            onChange={e => handleSearch(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && searchQuery.length >= 2) {
                handleSearch(searchQuery)
              }
            }}
          />
          {searchQuery && (
            <div
              style={{
                position: 'absolute',
                right: '14px',
                top: '50%',
                transform: 'translateY(-50%)',
                cursor: 'pointer',
                color: COLORS.textMuted,
              }}
              onClick={() => handleSearch('')}
            >
              <X size={18} />
            </div>
          )}
        </div>
        
        {/* 搜索提示 */}
        {searchQuery.length > 0 && searchQuery.length < 2 && (
          <div style={{
            padding: '12px',
            backgroundColor: COLORS.warningLight,
            borderRadius: '8px',
            fontSize: '13px',
            color: COLORS.warning,
            marginBottom: '16px',
          }}>
            {t('clinicalData.minChars')}
          </div>
        )}
        
        {/* 搜索状态 */}
        {isSearching && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            color: COLORS.textMuted,
          }}>
            <RefreshCw size={20} className="animate-spin" style={{ marginRight: '8px' }} />
            {t('clinicalData.searching')}
          </div>
        )}
      </div>
      
      {/* 搜索结果 */}
      {searchResults.length > 0 && (
        <div style={styles.card}>
          <div style={{ ...styles.cardTitle, marginBottom: '12px' }}>
            <FileText size={18} color={COLORS.primary} />
            {t('clinicalData.searchResults')}
            <span style={{
              marginLeft: '8px',
              padding: '2px 8px',
              backgroundColor: COLORS.primary,
              borderRadius: '10px',
              color: '#fff',
              fontSize: '11px',
            }}>
              {t('clinicalData.resultCount', { count: searchResults.length })}
            </span>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {searchResults.map(result => (
              <div
                key={result.patientId}
                style={{
                  padding: '16px',
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = COLORS.primary
                  e.currentTarget.style.backgroundColor = 'var(--bg-hover)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = COLORS.border
                  e.currentTarget.style.backgroundColor = 'var(--bg-card)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={styles.avatar(COLORS.primary)}>
                    {result.name.charAt(0)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 600, fontSize: '14px' }}>{result.name}</span>
                      <span style={{ fontSize: '12px', color: COLORS.textMuted }}>
                        {result.gender} | {t('clinicalData.yearsOld', { age: result.age })}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: COLORS.textMuted }}>
                      <span>ID: {result.patientId}</span>
                      <span>|</span>
                      <span>{t('clinicalData.lastVisit', { date: result.lastVisit })}</span>
                      <span>|</span>
                      <span style={{
                        padding: '2px 6px',
                        backgroundColor: result.matchType === 'id' ? '#eff6ff' : COLORS.successLight,
                        borderRadius: '4px',
                        color: result.matchType === 'id' ? COLORS.primary : COLORS.success,
                      }}>
                        {result.matchType === 'id' ? t('clinicalData.idMatch') : t('clinicalData.nameMatch')}: {result.matchValue}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    {result.dataSources.map(src => (
                      <DataSourceBadge key={src} source={src} />
                    ))}
                  </div>
                  <button
                    style={styles.btn(COLORS.primary)}
                    onClick={e => {
                      e.stopPropagation()
                      if (onSelectPatient) {
                        onSelectPatient(result.patientId)
                      }
                    }}
                  >
                    <Eye size={14} />
                    {t('clinicalData.viewDetail')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* 无结果提示 */}
      {searchQuery.length >= 2 && searchResults.length === 0 && !isSearching && (
        <div style={styles.card}>
          <div style={{
            textAlign: 'center',
            padding: '40px 20px',
            color: COLORS.textMuted,
          }}>
            <Search size={40} style={{ marginBottom: '12px', opacity: 0.5 }} />
            <div style={{ fontSize: '14px', marginBottom: '4px' }}>{t('clinicalData.noResults')}</div>
            <div style={{ fontSize: '12px' }}>{t('clinicalData.tryOtherKeywords')}</div>
          </div>
        </div>
      )}
      
      {/* 最近搜索 */}
      {searchResults.length === 0 && searchQuery.length === 0 && recentSearches.length > 0 && (
        <div style={styles.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ ...styles.cardTitle, marginBottom: 0 }}>
              <Clock size={18} color={COLORS.primary} />
              {t('clinicalData.recentSearches')}
            </div>
            <button
              style={{
                border: 'none',
                background: 'none',
                color: COLORS.textMuted,
                cursor: 'pointer',
                fontSize: '12px',
              }}
              onClick={clearRecentSearches}
            >
              {t('clinicalData.clear')}
            </button>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {recentSearches.map((term, i) => (
              <div
                key={i}
                style={{
                  padding: '8px 14px',
                  backgroundColor: COLORS.bgGray,
                  borderRadius: '16px',
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
                onClick={() => handleSearch(term)}
              >
                <Search size={14} />
                {term}
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* 搜索提示 */}
      <div style={styles.card}>
        <div style={{ ...styles.cardTitle, marginBottom: '12px' }}>
          <Bell size={18} color={COLORS.primary} />
          {t('clinicalData.searchTips')}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
          <div style={{ padding: '12px', backgroundColor: COLORS.bgGray, borderRadius: '8px' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>{t('clinicalData.searchMethods')}</div>
            <div style={{ fontSize: '11px', color: COLORS.textMuted }}>
              {t('clinicalData.searchById')}<br/>
              {t('clinicalData.searchByName')}<br/>
              {t('clinicalData.searchByPhone')}
            </div>
          </div>
          <div style={{ padding: '12px', backgroundColor: COLORS.bgGray, borderRadius: '8px' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>{t('clinicalData.dataSourceDesc')}</div>
            <div style={{ fontSize: '11px', color: COLORS.textMuted }}>
              {t('clinicalData.searchScopeLine1')}<br/>
              {t('clinicalData.searchScopeLine2')}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ==================== 主组件 ====================
export default function ClinicalDataPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('patient360')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      const res = await patientApi.list({})
      if (cancelled) return
      if (res.success) {
        setLoadError(null)
      } else {
        setLoadError(t('clinicalData.apiError'))
      }
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [])

  return (
    <div data-testid="clinical-data-page" style={styles.pageContainer}>
      {loading && <LoadingBanner message={t('clinicalData.loadingMsg')} />}
      {loadError && !loading && <ErrorBanner message={loadError} />}
      {/* 顶部标题栏 */}
      <div style={styles.header}>
        <div>
          <div style={styles.headerTitle}>
            <Database size={24} />
            {t('clinicalData.title')}
          </div>
          <div style={styles.headerSubtitle}>
            {t('clinicalData.subtitle')}
          </div>
        </div>
        <div style={styles.headerActions}>
          <button style={styles.headerBtn} onClick={async (evt) => {
            const btn = (evt?.target || evt?.currentTarget) as HTMLButtonElement;
            const orig = btn.innerHTML;
            btn.innerHTML = '⏳...';
            btn.disabled = true;
            await new Promise(r => setTimeout(r, 1500));
            const reminders: any = (() => { try { return JSON.parse(localStorage.getItem('g005_clinical_reminders') || '{"enabled":false}') } catch { return { enabled: false } } })();
            reminders.enabled = !reminders.enabled;
            localStorage.setItem('g005_clinical_reminders', JSON.stringify(reminders));
            btn.innerHTML = reminders.enabled ? t('clinicalData.reminderOn') : t('clinicalData.reminderOff');
            setTimeout(() => { btn.innerHTML = orig; btn.disabled = false; }, 2000);
          }}>
            <Bell size={16} />
            {t('clinicalData.reminder')}
          </button>
          <button style={styles.headerBtn} onClick={async (evt) => {
            const btn = (evt?.target || evt?.currentTarget) as HTMLButtonElement;
            const orig = btn.innerHTML;
            btn.innerHTML = '⏳...';
            btn.disabled = true;
            await new Promise(r => setTimeout(r, 1500));
            const settings: any = (() => { try { return JSON.parse(localStorage.getItem('g005_clinical_settings') || '{}') } catch { return {} } })();
            localStorage.setItem('g005_clinical_settings', JSON.stringify({ ...settings, lastOpened: new Date().toISOString() }));
            btn.innerHTML = t('clinicalData.settingsOpened');
            setTimeout(() => { btn.innerHTML = orig; btn.disabled = false; }, 2000);
          }}>
            <Settings size={16} />
            {t('clinicalData.settings')}
          </button>
        </div>
      </div>
      
      {/* 内容区域 */}
      <div style={styles.content}>
        {/* 标签页切换 */}
        <div style={styles.tabContainer}>
          <button
            style={styles.tab(activeTab === 'patient360')}
            onClick={() => setActiveTab('patient360')}
          >
            <User size={16} />
            {t('clinicalData.tabPatient360')}
          </button>
          <button
            style={styles.tab(activeTab === 'sync')}
            onClick={() => setActiveTab('sync')}
          >
            <SyncIcon size={16} />
            {t('clinicalData.tabSync')}
          </button>
          <button
            style={styles.tab(activeTab === 'quality')}
            onClick={() => setActiveTab('quality')}
          >
            <ShieldCheck size={16} />
            {t('clinicalData.tabQuality')}
          </button>
          <button
            style={styles.tab(activeTab === 'search')}
            onClick={() => setActiveTab('search')}
          >
            <Search size={16} />
            {t('clinicalData.tabCdrSearch')}
          </button>
        </div>
        
        {/* 内容 */}
        {activeTab === 'patient360' && <Patient360View />}
        {activeTab === 'sync' && <CrossSystemSync />}
        {activeTab === 'quality' && <DataQualityMonitor />}
        {activeTab === 'search' && <CDRSearchView />}
      </div>
    </div>
  )
}
