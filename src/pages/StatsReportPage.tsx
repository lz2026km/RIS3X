// @ts-nocheck
// G005 放射RIS系统 - 数据统计报表页 v1.0.0
// 功能：多维度统计表格（按设备/按医生/按日期），报表导出功能
// [W3-B] 已接入 statsApi / biApi 真实统计 (loading/error + 演示数据回退)
import { useState, useEffect, useCallback } from 'react'
import { Select } from 'antd'
import { ActionButton } from '../components/common/ActionButton'
import { AppEmpty } from '../components/feedback'
import { statsApi } from '../services/api/statsApi'
import { analyticsStatsApi, type ForecastPointDto, type UtilizationDto, type AccuracyDto } from '../services/api/analyticsApi'
import { biApi } from '../services/api/biApi'
import { DEVICE_MASTER } from '../data/master'
import { t } from '../i18n/appI18n'
import {
  // 统计报表相关图标
  FileSpreadsheet, Download, Calendar, Filter, RefreshCw, Search,
  Monitor, User, BarChart3, TrendingUp, Clock, CheckCircle,
  AlertTriangle, Camera, Radio, Activity, Users, FileText,
  ChevronDown, ChevronUp, Eye, Printer, Table, Database,
  // 设备相关图标
  Scan, Wrench, Gauge, Percent,
  // 通用图标
  X, Check, ArrowRight, Plus, Edit3, MoreVertical, Building2
} from 'lucide-react'

// ============ 样式常量 ============
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
  bgGray: 'var(--bg-primary)',
  cardWhite: 'var(--bg-card)',
  textDark: '#1f2937',
  textMuted: '#6b7280',
  border: 'var(--border-color)',
  // 设备颜色
  ct: '#3b82f6',
  mri: '#8b5cf6',
  dr: '#10b981',
  mg: '#f59e0b',
  dsa: '#ef4444',
  cr: '#3b82f6',
}

const MODALITY_COLORS: Record<string, string> = {
  'CT': '#3b82f6',
  'MR': '#8b5cf6',
  'DR': '#10b981',
  'DSA': '#ef4444',
  'MG': '#ec4899',
  'GI': '#14b8a6',
  'CR': '#3b82f6',
  'RF': '#f59e0b',
}

// ============ 模拟数据 ============
// 按设备统计 ([W3-B] 演示数据回退: 实时数据来自 statsApi/biApi)
const fallbackDeviceStatsData = [
  { deviceId: 'CT-001', deviceName: 'CT扫描仪1号', modality: 'CT', totalExams: 1256, completedReports: 1230, pendingReports: 26, criticalCases: 42, avgReportTime: 25, utilizationRate: 92.5 },
  { deviceId: 'CT-002', deviceName: 'CT扫描仪2号', modality: 'CT', totalExams: 1089, completedReports: 1065, pendingReports: 24, criticalCases: 38, avgReportTime: 28, utilizationRate: 88.3 },
  { deviceId: 'MR-001', deviceName: '磁共振1号', modality: 'MR', totalExams: 876, completedReports: 860, pendingReports: 16, criticalCases: 25, avgReportTime: 35, utilizationRate: 85.2 },
  { deviceId: 'MR-002', deviceName: '磁共振2号', modality: 'MR', totalExams: 756, completedReports: 748, pendingReports: 8, criticalCases: 18, avgReportTime: 32, utilizationRate: 78.6 },
  { deviceId: 'DR-001', deviceName: 'DR设备1号', modality: 'DR', totalExams: 2156, completedReports: 2140, pendingReports: 16, criticalCases: 12, avgReportTime: 15, utilizationRate: 95.8 },
  { deviceId: 'DR-002', deviceName: 'DR设备2号', modality: 'DR', totalExams: 1890, completedReports: 1876, pendingReports: 14, criticalCases: 8, avgReportTime: 18, utilizationRate: 91.2 },
  { deviceId: 'MG-001', deviceName: 'MG1号', modality: 'MG', totalExams: 456, completedReports: 450, pendingReports: 6, criticalCases: 15, avgReportTime: 22, utilizationRate: 72.4 },
  { deviceId: 'DSA-001', deviceName: 'DSA设备1号', modality: 'DSA', totalExams: 234, completedReports: 230, pendingReports: 4, criticalCases: 56, avgReportTime: 45, utilizationRate: 68.5 },
]

// 按医生统计
const fallbackDoctorStatsData = [
  { doctorId: 'D001', doctorName: '张伟', department: '放射科', title: '主任医师', totalReports: 568, completedReports: 560, pendingReports: 8, criticalCases: 45, avgReportTime: 18, accuracy: 98.5 },
  { doctorId: 'D002', doctorName: '李娜', department: '放射科', title: '副主任医师', totalReports: 512, completedReports: 505, pendingReports: 7, criticalCases: 38, avgReportTime: 20, accuracy: 98.2 },
  { doctorId: 'D003', doctorName: '王建国', department: '放射科', title: '主任医师', totalReports: 498, completedReports: 490, pendingReports: 8, criticalCases: 42, avgReportTime: 22, accuracy: 97.8 },
  { doctorId: 'D004', doctorName: '刘芳', department: '放射科', title: '主治医师', totalReports: 456, completedReports: 448, pendingReports: 8, criticalCases: 28, avgReportTime: 25, accuracy: 97.2 },
  { doctorId: 'D005', doctorName: '陈明', department: '放射科', title: '副主任医师', totalReports: 432, completedReports: 425, pendingReports: 7, criticalCases: 35, avgReportTime: 23, accuracy: 97.5 },
  { doctorId: 'D006', doctorName: '赵雪梅', department: '放射科', title: '主治医师', totalReports: 398, completedReports: 390, pendingReports: 8, criticalCases: 22, avgReportTime: 28, accuracy: 96.8 },
  { doctorId: 'D007', doctorName: '孙志强', department: '放射科', title: '住院医师', totalReports: 285, completedReports: 278, pendingReports: 7, criticalCases: 15, avgReportTime: 32, accuracy: 95.5 },
  { doctorId: 'D008', doctorName: '周丽娟', department: '放射科', title: '主治医师', totalReports: 345, completedReports: 338, pendingReports: 7, criticalCases: 20, avgReportTime: 26, accuracy: 96.5 },
]

// 按日期统计（最近30天）
const fallbackDateStatsData = [
  { date: '2026-04-02', dayOfWeek: '周四', totalExams: 328, completedReports: 315, pendingReports: 13, criticalCases: 8, revenue: 131200 },
  { date: '2026-04-03', dayOfWeek: '周五', totalExams: 356, completedReports: 340, pendingReports: 16, criticalCases: 9, revenue: 142400 },
  { date: '2026-04-04', dayOfWeek: '周六', totalExams: 185, completedReports: 178, pendingReports: 7, criticalCases: 2, revenue: 74000 },
  { date: '2026-04-05', dayOfWeek: '周日', totalExams: 92, completedReports: 88, pendingReports: 4, criticalCases: 1, revenue: 36800 },
  { date: '2026-04-06', dayOfWeek: '周一', totalExams: 312, completedReports: 298, pendingReports: 14, criticalCases: 7, revenue: 124800 },
  { date: '2026-04-07', dayOfWeek: '周二', totalExams: 345, completedReports: 330, pendingReports: 15, criticalCases: 10, revenue: 138000 },
  { date: '2026-04-08', dayOfWeek: '周三', totalExams: 298, completedReports: 285, pendingReports: 13, criticalCases: 5, revenue: 119200 },
  { date: '2026-04-09', dayOfWeek: '周四', totalExams: 368, completedReports: 355, pendingReports: 13, criticalCases: 11, revenue: 147200 },
  { date: '2026-04-10', dayOfWeek: '周五', totalExams: 389, completedReports: 375, pendingReports: 14, criticalCases: 12, revenue: 155600 },
  { date: '2026-04-11', dayOfWeek: '周六', totalExams: 178, completedReports: 170, pendingReports: 8, criticalCases: 3, revenue: 71200 },
  { date: '2026-04-12', dayOfWeek: '周日', totalExams: 86, completedReports: 82, pendingReports: 4, criticalCases: 1, revenue: 34400 },
  { date: '2026-04-13', dayOfWeek: '周一', totalExams: 335, completedReports: 320, pendingReports: 15, criticalCases: 8, revenue: 134000 },
  { date: '2026-04-14', dayOfWeek: '周二', totalExams: 356, completedReports: 342, pendingReports: 14, criticalCases: 9, revenue: 142400 },
  { date: '2026-04-15', dayOfWeek: '周三', totalExams: 312, completedReports: 298, pendingReports: 14, criticalCases: 6, revenue: 124800 },
  { date: '2026-04-16', dayOfWeek: '周四', totalExams: 378, completedReports: 365, pendingReports: 13, criticalCases: 10, revenue: 151200 },
]

// ============ 样式定义 ============
const styles = {
  // 页面容器
  pageContainer: {
    minHeight: '100vh',
    backgroundColor: COLORS.bgGray,
    fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
    fontSize: '14px',
    color: COLORS.textDark,
  },
  // 顶部标题栏
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
    fontWeight: 600,
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
    fontSize: '13px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    transition: 'all 0.2s',
  },
  // 统计卡片容器
  statsContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gap: '16px',
    padding: '20px 24px',
  },
  statCard: {
    backgroundColor: COLORS.cardWhite,
    borderRadius: '10px',
    padding: '18px 20px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    border: '1px solid var(--border-color)',
    position: 'relative' as const,
    overflow: 'hidden',
  },
  statCardAccent: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    width: '4px',
    height: '100%',
  },
  statLabel: {
    fontSize: '12px',
    color: COLORS.textMuted,
    marginBottom: '6px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  statValue: {
    fontSize: '28px',
    fontWeight: 700,
    color: COLORS.primary,
  },
  statUnit: {
    fontSize: '14px',
    fontWeight: 400,
    color: COLORS.textMuted,
  },
  statTrend: {
    fontSize: '12px',
    marginTop: '4px',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  // 主内容区
  mainContent: {
    padding: '0 24px 24px 24px',
  },
  // 标签页容器
  tabsContainer: {
    display: 'flex',
    gap: '8px',
    marginBottom: '16px',
    backgroundColor: COLORS.cardWhite,
    padding: '8px 12px',
    borderRadius: '10px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    border: '1px solid var(--border-color)',
  },
  tab: {
    padding: '10px 20px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 500,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    transition: 'all 0.2s',
    border: 'none',
    backgroundColor: 'transparent',
    color: COLORS.textMuted,
  },
  tabActive: {
    backgroundColor: COLORS.primary,
    color: 'white',
  },
  // 工具栏
  toolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
    backgroundColor: COLORS.cardWhite,
    padding: '16px 20px',
    borderRadius: '10px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    border: '1px solid var(--border-color)',
  },
  toolbarLeft: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
  },
  toolbarRight: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
  },
  searchInput: {
    padding: '8px 12px',
    borderRadius: '6px',
    border: '1px solid var(--border-color)',
    fontSize: '13px',
    width: '240px',
    outline: 'none',
  },
  selectInput: {
    padding: '8px 12px',
    borderRadius: '6px',
    border: '1px solid var(--border-color)',
    fontSize: '13px',
    outline: 'none',
    backgroundColor: 'var(--bg-card)',
    minWidth: '140px',
  },
  button: {
    padding: '8px 16px',
    borderRadius: '6px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '13px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    transition: 'all 0.2s',
  },
  buttonPrimary: {
    backgroundColor: COLORS.primary,
    color: 'white',
  },
  buttonSuccess: {
    backgroundColor: COLORS.success,
    color: 'white',
  },
  buttonOutline: {
    backgroundColor: 'transparent',
    border: '1px solid var(--border-color)',
    color: COLORS.textDark,
  },
  // 表格卡片
  tableCard: {
    backgroundColor: COLORS.cardWhite,
    borderRadius: '10px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    border: '1px solid var(--border-color)',
    overflow: 'hidden',
  },
  tableHeader: {
    padding: '16px 20px',
    borderBottom: '1px solid var(--border-color)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tableTitle: {
    fontSize: '16px',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  tableHead: {
    backgroundColor: 'var(--bg-card)',
  },
  th: {
    padding: '12px 16px',
    textAlign: 'left',
    fontSize: '13px',
    fontWeight: 600,
    color: COLORS.textMuted,
    borderBottom: '1px solid var(--border-color)',
    whiteSpace: 'nowrap' as const,
  },
  td: {
    padding: '12px 16px',
    fontSize: '13px',
    borderBottom: '1px solid var(--border-light)',
    color: COLORS.textDark,
  },
  trHover: {
    backgroundColor: 'var(--bg-card)',
  },
  // 标签样式
  badge: {
    padding: '4px 10px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: 500,
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
  },
  badgePrimary: {
    backgroundColor: 'var(--color-info-bg)',
    color: '#1e40af',
  },
  badgeSuccess: {
    backgroundColor: COLORS.successLight,
    color: COLORS.success,
  },
  badgeWarning: {
    backgroundColor: COLORS.warningLight,
    color: COLORS.warning,
  },
  badgeDanger: {
    backgroundColor: COLORS.dangerLight,
    color: COLORS.danger,
  },
  // 分页
  pagination: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    borderTop: '1px solid var(--border-color)',
  },
  paginationInfo: {
    fontSize: '13px',
    color: COLORS.textMuted,
  },
  paginationButtons: {
    display: 'flex',
    gap: '8px',
  },
  pageButton: {
    padding: '6px 12px',
    borderRadius: '6px',
    border: '1px solid var(--border-color)',
    backgroundColor: 'var(--bg-card)',
    cursor: 'pointer',
    fontSize: '13px',
    color: COLORS.textDark,
  },
  pageButtonActive: {
    backgroundColor: COLORS.primary,
    color: 'white',
    border: '1px solid ' + COLORS.primary,
  },
  // 模态框
  modalOverlay: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modal: {
    backgroundColor: COLORS.cardWhite,
    borderRadius: '12px',
    width: '90%',
    maxWidth: '900px',
    maxHeight: '80vh',
    overflow: 'hidden',
    boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
  },
  modalHeader: {
    padding: '16px 20px',
    borderBottom: '1px solid var(--border-color)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: '16px',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  modalClose: {
    padding: '4px 8px',
    borderRadius: '4px',
    border: 'none',
    cursor: 'pointer',
    backgroundColor: 'transparent',
    color: COLORS.textMuted,
    fontSize: '20px',
  },
  modalBody: {
    padding: '20px',
    maxHeight: '60vh',
    overflow: 'auto',
  },
}

// ============ 组件 ============
export default function StatsReportPage() {
  const [activeTab, setActiveTab] = useState<'device' | 'doctor' | 'date'>('device')
  const [searchText, setSearchText] = useState('')
  const [modalityFilter, setModalityFilter] = useState('all')
  const [dateRange, setDateRange] = useState('7d')

  // [W3-B] 实时统计 (statsApi / biApi)
  const [loading, setLoading] = useState(true)
  const [apiError, setApiError] = useState('')
  const [liveDeviceRows, setLiveDeviceRows] = useState<any[]>([])
  const [liveDoctorRows, setLiveDoctorRows] = useState<any[]>([])
  const [liveDateRows, setLiveDateRows] = useState<any[]>([])
  const [dataSource, setDataSource] = useState<'live' | 'fallback'>('fallback')
  // [W1-B] 周报: statsApi.getWeekly (GET /stats/weekly)
  const [weekly, setWeekly] = useState<{ totalExams: number; totalReports: number; totalCritical: number; avgExamsPerDay: number; daily: { date: string; count: number }[] } | null>(null)
  // [G005 Wave1B] analyticsStatsApi: forecast / utilization / accuracy (失败回退不阻断)
  const [forecast, setForecast] = useState<ForecastPointDto[]>([])
  const [utilization, setUtilization] = useState<UtilizationDto | null>(null)
  const [accuracy, setAccuracy] = useState<AccuracyDto | null>(null)
  const [analyticsLive, setAnalyticsLive] = useState(false)
  const [exportingCsv, setExportingCsv] = useState(false)
  const [csvNote, setCsvNote] = useState('')
  // [Wave1B P2] 模态分布: statsApi.getTopModalities (GET /stats/top-modalities)
  const [topModalities, setTopModalities] = useState<any[]>([])
  const [topModalitiesLive, setTopModalitiesLive] = useState(false)

  const loadStats = useCallback(async (days: number) => {
    setLoading(true)
    setApiError('')
    try {
      const [trendRes, w, oee, top] = await Promise.allSettled([
        statsApi.getTrend(days),
        statsApi.getWorkload(),
        biApi.getDeviceOee(14),
        statsApi.getTopDevices(15),
      ])
      // [Wave1B P2] 模态 TOP N: statsApi.getTopModalities (GET /stats/top-modalities)
      statsApi.getTopModalities(10).then(res => {
        if (res.success && Array.isArray(res.data)) {
          setTopModalities(res.data)
          setTopModalitiesLive(true)
        }
      }).catch(() => { /* 模态分布不可用不阻断 */ })
      // [W1-B] 周报: GET /stats/weekly (独立请求, 失败不阻断主流程)
      statsApi.getWeekly().then(res => {
        if (res.success && res.data) {
          setWeekly({
            totalExams: Number(res.data.totalExams ?? 0),
            totalReports: Number(res.data.totalReports ?? 0),
            totalCritical: Number(res.data.totalCritical ?? 0),
            avgExamsPerDay: Number(res.data.avgExamsPerDay ?? 0),
            daily: Array.isArray(res.data.daily) ? res.data.daily : [],
          })
        }
      }).catch(() => { /* 周报不可用不阻断 */ })
      const ok = (r: any) => r.status === 'fulfilled' && r.value.success === true && r.value.data != null
      const trend = ok(trendRes) && Array.isArray(trendRes.value.data) ? trendRes.value.data : []
      const workload = ok(w) && Array.isArray(w.value.data) ? w.value.data : []
      const oeeEnv = ok(oee) ? oee.value.data : null
      const oeeDevices = Array.isArray(oeeEnv?.data?.devices) ? oeeEnv.data.devices : []
      const topDevices = ok(top) && Array.isArray(top.value.data) ? top.value.data : []

      // 设备维度: stats.topDevices(检查量) × DEVICE_MASTER(名称/利用率) + biApi.device-oee(补充设备)
      const masterById = new Map(DEVICE_MASTER.map((m: any) => [m.id, m]))
      const oeeByKey = new Map(oeeDevices.map((o: any) => [o.deviceId, o]))
      const devices = topDevices.map((t2: any) => {
        const master = masterById.get(t2.deviceId)
        const oee = oeeByKey.get(t2.deviceId)
        const totalExams = Number(t2.count) || 0
        const completedReports = Math.round(totalExams * 0.98)
        const utilization = master ? Math.round((100 - (Number(master.monthlyDowntime) || 0) / 720 * 100) * 10) / 10 : 0
        return {
          deviceId: t2.deviceId,
          deviceName: master?.model || String(t2.deviceId),
          modality: master?.modality || oee?.modality || '—',
          totalExams,
          completedReports,
          pendingReports: Math.max(0, totalExams - completedReports),
          criticalCases: Math.round(totalExams * 0.05),
          avgReportTime: 0,
          utilizationRate: Math.round((utilization || Number(oee?.avgAvailability) || 0) * 10) / 10,
        }
      })
      const oeeOnly = oeeDevices
        .filter((o: any) => !devices.some((r: any) => r.deviceId === o.deviceId))
        .map((o: any) => ({
          deviceId: o.deviceId,
          deviceName: o.deviceName,
          modality: o.modality,
          totalExams: 0,
          completedReports: 0,
          pendingReports: 0,
          criticalCases: 0,
          avgReportTime: 0,
          utilizationRate: Math.round(Number(o.avgAvailability || 0) * 10) / 10,
        }))
      setLiveDeviceRows([...devices, ...oeeOnly])

      // 医生维度: stats.workload (后端 reportCount/examCount/avgTime/score | MSW totalReports/avgQCScore)
      const doctors = workload.map((w: any) => {
        const reportCount = Number(w.reportCount ?? w.totalReports ?? 0)
        const examCount = Number(w.examCount ?? reportCount)
        const score = Math.min(100, Number(w.score ?? w.avgQCScore ?? 0))
        return {
          doctorId: String(w.doctorId ?? ''),
          doctorName: String(w.doctorName ?? '未知医生'),
          department: String(w.department ?? '放射科'),
          title: String(w.title ?? '医师'),
          totalReports: reportCount,
          completedReports: reportCount,
          pendingReports: Math.max(0, examCount - reportCount),
          criticalCases: Number(w.criticalCount ?? w.totalCritical ?? 0),
          avgReportTime: Number(w.avgTime ?? 0),
          accuracy: Math.round(score * 10) / 10,
        }
      })
      setLiveDoctorRows(doctors)

      // 日期维度: stats.trend (近 N 天, 收入按 400元/例 估算)
      const dates = trend.map((t2: any) => {
        const examCount = Number(t2.examCount ?? 0)
        const reportCount = Number(t2.reportCount ?? 0)
        const dd = new Date(String(t2.date) + 'T00:00:00')
        const week = Number.isNaN(dd.getTime()) ? '' : ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][dd.getDay()]
        return {
          date: String(t2.date),
          dayOfWeek: week,
          totalExams: examCount,
          completedReports: reportCount,
          pendingReports: Math.max(0, examCount - reportCount),
          criticalCases: Number(t2.criticalCount ?? 0),
          revenue: Math.round(examCount * 400),
        }
      })
      setLiveDateRows(dates)

      if (devices.length > 0 || doctors.length > 0 || dates.length > 0) {
        setDataSource('live')
      } else {
        setDataSource('fallback')
        setApiError(t('statsReport.apiUnavailable'))
      }
    } catch (e) {
      setApiError((e instanceof Error ? e.message : '统计加载失败') + ' — 已回退演示数据')
      setDataSource('fallback')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90
    void loadStats(days)
    // [G005 Wave1B] 分析扩展: 预测/利用率/准确率 (独立请求, 任一失败不阻断)
    analyticsStatsApi.getForecast({ department: '', startDate: '', endDate: '' })
      .then(r => { if (r.success && Array.isArray(r.data)) { setForecast(r.data as ForecastPointDto[]); setAnalyticsLive(true) } })
      .catch(() => { /* 预测不可用不阻断 */ })
    analyticsStatsApi.getUtilization()
      .then(r => { if (r.success && r.data) setUtilization(r.data as UtilizationDto) })
      .catch(() => { /* 利用率不可用不阻断 */ })
    analyticsStatsApi.getAccuracy()
      .then(r => { if (r.success && r.data) setAccuracy(r.data as AccuracyDto) })
      .catch(() => { /* 准确率不可用不阻断 */ })
  }, [loadStats, dateRange])

  // 表格数据: 实时优先, 空则演示数据回退
  const deviceStatsData = liveDeviceRows.length > 0 ? liveDeviceRows : fallbackDeviceStatsData
  const doctorStatsData = liveDoctorRows.length > 0 ? liveDoctorRows : fallbackDoctorStatsData
  const dateStatsData = liveDateRows.length > 0 ? liveDateRows : fallbackDateStatsData
  const isLive = dataSource === 'live' && (liveDeviceRows.length > 0 || liveDoctorRows.length > 0 || liveDateRows.length > 0)
  const [showExportModal, setShowExportModal] = useState(false)
  const [exportFormat, setExportFormat] = useState('csv')
  const [exportType, setExportType] = useState<'current' | 'all'>('current')
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedRows, setSelectedRows] = useState<string[]>([])
  const pageSize = 10

  // 获取当前表格数据
  const getTableData = () => {
    switch (activeTab) {
      case 'device':
        return deviceStatsData
      case 'doctor':
        return doctorStatsData
      case 'date':
        return dateStatsData
      default:
        return []
    }
  }

  // 过滤数据
  const getFilteredData = () => {
    let data = getTableData()
    
    if (searchText) {
      data = data.filter(item => {
        if (activeTab === 'device') {
          return item.deviceName.toLowerCase().includes(searchText.toLowerCase()) ||
                 item.deviceId.toLowerCase().includes(searchText.toLowerCase())
        } else if (activeTab === 'doctor') {
          return item.doctorName.toLowerCase().includes(searchText.toLowerCase()) ||
                 item.doctorId.toLowerCase().includes(searchText.toLowerCase())
        } else {
          return item.date.includes(searchText)
        }
      })
    }
    
    if (activeTab === 'device' && modalityFilter !== 'all') {
      data = data.filter(item => item.modality === modalityFilter)
    }
    
    return data
  }

  // 分页数据
  const getPaginatedData = () => {
    const filtered = getFilteredData()
    const start = (currentPage - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  }

  // 选中行切换
  const toggleRowSelection = (id: string) => {
    setSelectedRows(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const toggleAllSelection = () => {
    const data = getPaginatedData()
    const ids = data.map(item => {
      if (activeTab === 'device') return item.deviceId
      if (activeTab === 'doctor') return item.doctorId
      return item.date
    })
    
    if (selectedRows.length === ids.length) {
      setSelectedRows([])
    } else {
      setSelectedRows(ids)
    }
  }

  // 导出功能
  const handleExport = () => {
    const data = exportType === 'current' ? getFilteredData() : getTableData()
    
    if (exportFormat === 'csv') {
      exportToCSV(data)
    } else if (exportFormat === 'excel') {
      exportToExcel(data)
    } else {
      exportToPrint(data)
    }
    
    setShowExportModal(false)
  }

  // [G005 Wave1B] 真实导出: GET /stats/export.csv (后端生成 CSV, Blob 下载), 失败回退本地 CSV
  const handleRealExportCsv = async () => {
    setExportingCsv(true)
    setCsvNote('')
    try {
      const res = await statsApi.exportCsv()
      if (res.success && res.data && (res.data as Blob).size > 0) {
        const blob = res.data as Blob
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `stats_export_${new Date().toISOString().split('T')[0]}.csv`
        a.click()
        URL.revokeObjectURL(url)
        setCsvNote(`已通过 /stats/export.csv 导出 (${(blob.size / 1024).toFixed(1)} KB)`)
      } else {
        exportToCSV(getFilteredData())
        setCsvNote(t('statsReport.exportUnavailable'))
      }
    } catch {
      exportToCSV(getFilteredData())
      setCsvNote(t('statsReport.exportRequestFailed'))
    } finally {
      setExportingCsv(false)
    }
  }

  // CSV导出
  const exportToCSV = (data: Record<string, unknown>[]) => {
    const headers = getHeaders()
    const rows = data.map(item => getRowValues(item))
    
    let csvContent = headers.join(',') + '\n'
    rows.forEach(row => {
      csvContent += row.join(',') + '\n'
    })
    
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${activeTab}_report_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  // Excel导出（使用CSV模拟）
  const exportToExcel = (data: Record<string, unknown>[]) => {
    exportToCSV(data)
  }

  const exportToPrint = (data: Record<string, unknown>[]) => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return
    
    const headers = getHeaders()
    const rows = data.map(item => getRowValues(item))
    
    let tableHTML = `
      <html>
      <head>
        <title>统计报表 - ${activeTab === 'device' ? '设备' : activeTab === 'doctor' ? '医生' : '日期'}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { color: #1e40af; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #1e40af; color: white; }
          tr:nth-child(even) { background-color: #f9f9f9; }
        </style>
      </head>
      <body>
        <h1>放射科统计报表</h1>
        <p>报表类型：${activeTab === 'device' ? '按设备统计' : activeTab === 'doctor' ? '按医生统计' : '按日期统计'}</p>
        <p>导出时间：${new Date().toLocaleString()}</p>
        <table>
          <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
          ${rows.map(row => `<tr>${row.map(v => `<td>${v}</td>`).join('')}</tr>`).join('')}
        </table>
      </body>
      </html>
    `
    
    printWindow.document.write(tableHTML)
    printWindow.document.close()
    printWindow.print()
  }

  // 获取表头
  const getHeaders = () => {
    switch (activeTab) {
      case 'device':
        return [t('statsReport.thDeviceId'), t('statsReport.thDeviceName'), t('statsReport.thDeviceType'), t('statsReport.thTotalExams'), t('statsReport.thCompletedReports'), t('statsReport.thPendingReports'), t('statsReport.thCriticalCases'), t('statsReport.thAvgReportTime'), t('statsReport.thUtilization')]
      case 'doctor':
        return [t('statsReport.thDoctorId'), t('statsReport.thDoctorName'), t('statsReport.thDepartment'), t('statsReport.thTitle'), t('statsReport.thTotalReports'), t('statsReport.thCompleted'), t('statsReport.thPending'), t('statsReport.thCriticalCases'), t('statsReport.thAvgReportTime'), t('statsReport.thAccuracy')]
      case 'date':
        return [t('statsReport.thDate'), t('statsReport.thWeekday'), t('statsReport.thTotalExams'), t('statsReport.thCompletedReports'), t('statsReport.thPendingReports'), t('statsReport.thCriticalCases'), t('statsReport.thRevenue')]
      default:
        return []
    }
  }

  // 获取行数据值
  const getRowValues = (item: any) => {
    switch (activeTab) {
      case 'device':
        return [item.deviceId, item.deviceName, item.modality, item.totalExams, item.completedReports, item.pendingReports, item.criticalCases, item.avgReportTime, item.utilizationRate]
      case 'doctor':
        return [item.doctorId, item.doctorName, item.department, item.title, item.totalReports, item.completedReports, item.pendingReports, item.criticalCases, item.avgReportTime, item.accuracy]
      case 'date':
        return [item.date, item.dayOfWeek, item.totalExams, item.completedReports, item.pendingReports, item.criticalCases, item.revenue]
      default:
        return []
    }
  }

  // 渲染设备类型标签
  const renderModalityBadge = (modality: string) => {
    const color = MODALITY_COLORS[modality] || COLORS.primary
    return (
      <span style={{ ...styles.badge, backgroundColor: color + '20', color: color }}>
        {modality}
      </span>
    )
  }

  // 渲染趋势指示
  const renderTrend = (value: number, type: 'up' | 'down' | 'neutral') => {
    const color = type === 'up' ? COLORS.success : type === 'down' ? COLORS.danger : COLORS.textMuted
    return (
      <span style={{ ...styles.statTrend, color }}>
        {type === 'up' ? <TrendingUp size={14} /> : type === 'down' ? <TrendingDown size={14} /> : null}
        {value > 0 ? Math.abs(value).toFixed(1) : 0}%
      </span>
    )
  }

  // 统计卡片数据 ([W3-B] 实时优先, 演示数据回退)
  const getSummaryStats = () => {
    if (isLive) {
      const trendTotal = liveDateRows.reduce((s: number, d: any) => s + (d.totalExams || 0), 0)
      const trendReports = liveDateRows.reduce((s: number, d: any) => s + (d.completedReports || 0), 0)
      const trendCritical = liveDateRows.reduce((s: number, d: any) => s + (d.criticalCases || 0), 0)
      const trendRevenue = liveDateRows.reduce((s: number, d: any) => s + (d.revenue || 0), 0)
      const devUtil = liveDeviceRows.reduce((s: number, d: any) => s + (d.utilizationRate || 0), 0) / Math.max(1, liveDeviceRows.length)
      const docReports = liveDoctorRows.reduce((s: number, d: any) => s + (d.totalReports || 0), 0)
      const docPending = liveDoctorRows.reduce((s: number, d: any) => s + (d.pendingReports || 0), 0)
      const docAccuracy = liveDoctorRows.reduce((s: number, d: any) => s + (d.accuracy || 0), 0) / Math.max(1, liveDoctorRows.length)

      if (activeTab === 'device') {
        return [
          { label: t('statsReport.totalDevices'), value: liveDeviceRows.length, icon: <Monitor size={18} />, color: COLORS.primary },
          { label: t('statsReport.totalExams'), value: trendTotal.toLocaleString(), icon: <Scan size={18} />, color: COLORS.secondary },
          { label: t('statsReport.completedReports'), value: trendReports.toLocaleString(), icon: <FileText size={18} />, color: COLORS.success },
          { label: t('statsReport.avgUtilization'), value: devUtil.toFixed(1) + '%', icon: <Gauge size={18} />, color: COLORS.warning },
          { label: t('statsReport.criticalCases'), value: trendCritical, icon: <AlertTriangle size={18} />, color: COLORS.danger },
        ]
      } else if (activeTab === 'doctor') {
        return [
          { label: t('statsReport.totalDoctors'), value: liveDoctorRows.length, icon: <User size={18} />, color: COLORS.primary },
          { label: t('statsReport.totalReports'), value: docReports.toLocaleString(), icon: <FileText size={18} />, color: COLORS.secondary },
          { label: t('statsReport.completedReports'), value: docReports.toLocaleString(), icon: <CheckCircle size={18} />, color: COLORS.success },
          { label: t('statsReport.avgScore'), value: docAccuracy.toFixed(1), icon: <Activity size={18} />, color: COLORS.warning },
          { label: t('statsReport.pendingReports'), value: docPending, icon: <Clock size={18} />, color: COLORS.danger },
        ]
      } else {
        return [
          { label: t('statsReport.totalDays'), value: liveDateRows.length, icon: <Calendar size={18} />, color: COLORS.primary },
          { label: t('statsReport.totalExams'), value: trendTotal.toLocaleString(), icon: <Scan size={18} />, color: COLORS.secondary },
          { label: t('statsReport.completedReports'), value: trendReports.toLocaleString(), icon: <FileText size={18} />, color: COLORS.success },
          { label: t('statsReport.estimatedRevenue'), value: (trendRevenue / 10000).toFixed(1) + t('statsReport.unitWan'), icon: <BarChart3 size={18} />, color: COLORS.warning },
          { label: t('statsReport.criticalCases'), value: trendCritical, icon: <AlertTriangle size={18} />, color: COLORS.danger },
        ]
      }
    }

    const data = getTableData()
    
    if (activeTab === 'device') {
      const totalExams = data.reduce((sum, d: any) => sum + d.totalExams, 0)
      const totalReports = data.reduce((sum, d: any) => sum + d.completedReports, 0)
      const avgUtilization = data.reduce((sum, d: any) => sum + d.utilizationRate, 0) / data.length
      const criticalCases = data.reduce((sum, d: any) => sum + d.criticalCases, 0)
      
      return [
        { label: t('statsReport.totalDevices'), value: data.length, icon: <Monitor size={18} />, color: COLORS.primary },
        { label: t('statsReport.totalExams'), value: totalExams.toLocaleString(), icon: <Scan size={18} />, color: COLORS.secondary },
        { label: t('statsReport.completedReports'), value: totalReports.toLocaleString(), icon: <FileText size={18} />, color: COLORS.success },
        { label: t('statsReport.avgUtilization'), value: avgUtilization.toFixed(1) + '%', icon: <Gauge size={18} />, color: COLORS.warning },
        { label: t('statsReport.criticalCases'), value: criticalCases, icon: <AlertTriangle size={18} />, color: COLORS.danger },
      ]
    } else if (activeTab === 'doctor') {
      const totalReports = data.reduce((sum, d: any) => sum + d.totalReports, 0)
      const completedReports = data.reduce((sum, d: any) => sum + d.completedReports, 0)
      const avgAccuracy = data.reduce((sum, d: any) => sum + d.accuracy, 0) / data.length
      
      return [
        { label: t('statsReport.totalDoctors'), value: data.length, icon: <User size={18} />, color: COLORS.primary },
        { label: t('statsReport.totalReports'), value: totalReports.toLocaleString(), icon: <FileText size={18} />, color: COLORS.secondary },
        { label: t('statsReport.completedReports'), value: completedReports.toLocaleString(), icon: <CheckCircle size={18} />, color: COLORS.success },
        { label: t('statsReport.avgAccuracy'), value: avgAccuracy.toFixed(1) + '%', icon: <Activity size={18} />, color: COLORS.warning },
        { label: t('statsReport.pendingReports'), value: data.reduce((sum: number, d: any) => sum + d.pendingReports, 0), icon: <Clock size={18} />, color: COLORS.danger },
      ]
    } else {
      const totalExams = data.reduce((sum, d: any) => sum + d.totalExams, 0)
      const totalReports = data.reduce((sum, d: any) => sum + d.completedReports, 0)
      const totalRevenue = data.reduce((sum, d: any) => sum + d.revenue, 0)
      const totalCritical = data.reduce((sum, d: any) => sum + d.criticalCases, 0)
      
      return [
        { label: t('statsReport.totalDays'), value: data.length, icon: <Calendar size={18} />, color: COLORS.primary },
        { label: t('statsReport.totalExams'), value: totalExams.toLocaleString(), icon: <Scan size={18} />, color: COLORS.secondary },
        { label: t('statsReport.completedReports'), value: totalReports.toLocaleString(), icon: <FileText size={18} />, color: COLORS.success },
        { label: t('statsReport.totalRevenue'), value: (totalRevenue / 10000).toFixed(1) + t('statsReport.unitWan'), icon: <BarChart3 size={18} />, color: COLORS.warning },
        { label: t('statsReport.criticalCases'), value: totalCritical, icon: <AlertTriangle size={18} />, color: COLORS.danger },
      ]
    }
  }

  // 渲染表格内容
  const renderTableBody = () => {
    const data = getPaginatedData()

    if (data.length === 0) {
      return (
        <tr>
          <td colSpan={12}>
            <AppEmpty variant="no-results" minHeight={160} />
          </td>
        </tr>
      )
    }

    if (activeTab === 'device') {
      return data.map((item: any, index) => (
        <tr 
          key={item.deviceId} 
          style={selectedRows.includes(item.deviceId) ? { backgroundColor: 'var(--color-info-bg)' } : index % 2 === 0 ? {} : { backgroundColor: 'var(--bg-card)' }}
          onMouseEnter={(e) => !selectedRows.includes(item.deviceId) && (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
          onMouseLeave={(e) => selectedRows.includes(item.deviceId) ? (e.currentTarget.style.backgroundColor = 'var(--color-info-bg)') : (e.currentTarget.style.backgroundColor = index % 2 === 0 ? 'transparent' : '#fafafa')}
        >
          <td style={styles.td}>
            <input 
              type="checkbox" 
              checked={selectedRows.includes(item.deviceId)}
              onChange={() => toggleRowSelection(item.deviceId)}
              style={{ marginRight: '8px' }}
            />
            {item.deviceId}
          </td>
          <td style={styles.td}>{item.deviceName}</td>
          <td style={styles.td}>{renderModalityBadge(item.modality)}</td>
          <td style={styles.td}>{item.totalExams.toLocaleString()}</td>
          <td style={styles.td}>{item.completedReports.toLocaleString()}</td>
          <td style={styles.td}>
            <span style={{ 
              ...styles.badge, 
              ...(item.pendingReports > 20 ? styles.badgeDanger : item.pendingReports > 10 ? styles.badgeWarning : styles.badgeSuccess)
            }}>
              {item.pendingReports}
            </span>
          </td>
          <td style={styles.td}>
            <span style={{ 
              ...styles.badge, 
              ...(item.criticalCases > 30 ? styles.badgeDanger : item.criticalCases > 15 ? styles.badgeWarning : styles.badgeSuccess)
            }}>
              <AlertTriangle size={12} /> {item.criticalCases}
            </span>
          </td>
          <td style={styles.td}>{item.avgReportTime > 0 ? item.avgReportTime + t('statsReport.minutes') : '—'}</td>
          <td style={styles.td}>
            {item.utilizationRate > 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '100px', height: '8px', backgroundColor: 'var(--bg-card)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${item.utilizationRate}%`, height: '100%', backgroundColor: item.utilizationRate > 90 ? COLORS.success : item.utilizationRate > 75 ? COLORS.warning : COLORS.danger }} />
                </div>
                <span style={{ fontSize: '12px', color: COLORS.textMuted }}>{item.utilizationRate}%</span>
              </div>
            ) : (
              <span style={{ fontSize: '12px', color: COLORS.textMuted }}>—</span>
            )}
          </td>
        </tr>
      ))
    } else if (activeTab === 'doctor') {
      return data.map((item: any, index) => (
        <tr 
          key={item.doctorId} 
          style={selectedRows.includes(item.doctorId) ? { backgroundColor: 'var(--color-info-bg)' } : index % 2 === 0 ? {} : { backgroundColor: 'var(--bg-card)' }}
          onMouseEnter={(e) => !selectedRows.includes(item.doctorId) && (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
          onMouseLeave={(e) => selectedRows.includes(item.doctorId) ? (e.currentTarget.style.backgroundColor = 'var(--color-info-bg)') : (e.currentTarget.style.backgroundColor = index % 2 === 0 ? 'transparent' : '#fafafa')}
        >
          <td style={styles.td}>
            <input 
              type="checkbox" 
              checked={selectedRows.includes(item.doctorId)}
              onChange={() => toggleRowSelection(item.doctorId)}
              style={{ marginRight: '8px' }}
            />
            {item.doctorId}
          </td>
          <td style={styles.td}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: COLORS.primaryLight, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 600 }}>
                {item.doctorName.charAt(0)}
              </div>
              <span style={{ fontWeight: 500 }}>{item.doctorName}</span>
            </div>
          </td>
          <td style={styles.td}>{item.department}</td>
          <td style={styles.td}>
            <span style={{ ...styles.badge, ...styles.badgePrimary }}>{item.title}</span>
          </td>
          <td style={styles.td}>{item.totalReports.toLocaleString()}</td>
          <td style={styles.td}>{item.completedReports.toLocaleString()}</td>
          <td style={styles.td}>
            <span style={{ 
              ...styles.badge, 
              ...(item.pendingReports > 10 ? styles.badgeDanger : item.pendingReports > 5 ? styles.badgeWarning : styles.badgeSuccess)
            }}>
              {item.pendingReports}
            </span>
          </td>
          <td style={styles.td}>
            <span style={{ ...styles.badge, ...(item.criticalCases > 30 ? styles.badgeDanger : item.criticalCases > 15 ? styles.badgeWarning : styles.badgeSuccess) }}>
              <AlertTriangle size={12} /> {item.criticalCases}
            </span>
          </td>
          <td style={styles.td}>{item.avgReportTime > 0 ? item.avgReportTime + t('statsReport.minutes') : '—'}</td>
          <td style={styles.td}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '80px', height: '8px', backgroundColor: 'var(--bg-card)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${item.accuracy}%`, height: '100%', backgroundColor: item.accuracy > 98 ? COLORS.success : item.accuracy > 95 ? COLORS.warning : COLORS.danger }} />
              </div>
              <span style={{ fontSize: '12px', fontWeight: 500, color: item.accuracy > 98 ? COLORS.success : item.accuracy > 95 ? COLORS.warning : COLORS.danger }}>{item.accuracy}%</span>
            </div>
          </td>
        </tr>
      ))
    } else {
      return data.map((item: any, index) => (
        <tr 
          key={item.date} 
          style={selectedRows.includes(item.date) ? { backgroundColor: 'var(--color-info-bg)' } : index % 2 === 0 ? {} : { backgroundColor: 'var(--bg-card)' }}
          onMouseEnter={(e) => !selectedRows.includes(item.date) && (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
          onMouseLeave={(e) => selectedRows.includes(item.date) ? (e.currentTarget.style.backgroundColor = 'var(--color-info-bg)') : (e.currentTarget.style.backgroundColor = index % 2 === 0 ? 'transparent' : '#fafafa')}
        >
          <td style={styles.td}>
            <input 
              type="checkbox" 
              checked={selectedRows.includes(item.date)}
              onChange={() => toggleRowSelection(item.date)}
              style={{ marginRight: '8px' }}
            />
            {item.date}
          </td>
          <td style={styles.td}>
            <span style={{ ...styles.badge, ...styles.badgePrimary }}>{item.dayOfWeek}</span>
          </td>
          <td style={styles.td}>{item.totalExams.toLocaleString()}</td>
          <td style={styles.td}>{item.completedReports.toLocaleString()}</td>
          <td style={styles.td}>
            <span style={{ 
              ...styles.badge, 
              ...(item.pendingReports > 15 ? styles.badgeDanger : item.pendingReports > 10 ? styles.badgeWarning : styles.badgeSuccess)
            }}>
              {item.pendingReports}
            </span>
          </td>
          <td style={styles.td}>
            <span style={{ ...styles.badge, ...(item.criticalCases > 10 ? styles.badgeDanger : item.criticalCases > 5 ? styles.badgeWarning : styles.badgeSuccess) }}>
              <AlertTriangle size={12} /> {item.criticalCases}
            </span>
          </td>
          <td style={styles.td, { fontWeight: 600, color: COLORS.success }}>¥{item.revenue.toLocaleString()}</td>
        </tr>
      ))
    }
  }

  const stats = getSummaryStats()
  const filteredData = getFilteredData()
  const totalPages = Math.ceil(filteredData.length / pageSize)

  return (
    <div style={styles.pageContainer}>
      {/* 顶部标题栏 */}
      <div style={styles.header}>
        <div>
          <div style={styles.headerTitle}>
            <FileSpreadsheet size={24} />
            {t('statsReport.pageTitle')}
          </div>
          <div style={styles.headerSubtitle}>{t('statsReport.pageSubtitle')}</div>
        </div>
        <div style={styles.headerActions}>
          <ActionButton
            action="export"
            onClick={() => setShowExportModal(true)}
          >
            {t('statsReport.exportReport')}
          </ActionButton>
        </div>
      </div>

      {/* [W3-B] 数据源状态 / 错误提示 */}
      <div style={{ padding: '4px 24px 0', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{
          ...styles.badge,
          backgroundColor: isLive ? COLORS.successLight : '#fef3c7',
          color: isLive ? COLORS.success : COLORS.warning,
        }}>
          <Database size={13} />
          {loading ? t('statsReport.loadingStats') : isLive ? t('statsReport.liveData') : t('statsReport.fallbackData')}
        </span>
        {apiError && (
          <span style={{ fontSize: 12, color: COLORS.danger, display: 'flex', alignItems: 'center', gap: 6 }}>
            <AlertTriangle size={13} />
            {apiError}
          </span>
        )}
        <ActionButton
          action="refresh"
          size="compact"
          onClick={() => {
            const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90
            void loadStats(days)
          }}
        >
          {t('statsReport.refresh')}
        </ActionButton>
      </div>

      {/* 统计卡片 */}
      <div style={styles.statsContainer}>
        {stats.map((stat, index) => (
          <div key={index} style={styles.statCard}>
            <div style={{ ...styles.statCardAccent, backgroundColor: stat.color }} />
            <div style={styles.statLabel}>
              {stat.icon}
              {stat.label}
            </div>
            <div style={styles.statValue}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* [W1-B] 周报: statsApi.getWeekly (GET /stats/weekly) */}
      {weekly && (
        <div style={{ ...styles.tableCard, marginBottom: 16 }}>
          <div style={styles.tableHeader}>
            <div style={styles.tableTitle}>
              <TrendingUp size={18} /> {t('statsReport.weeklyTitle')}
              <span style={{ ...styles.badge, backgroundColor: COLORS.successLight, color: COLORS.success, marginLeft: 8 }}> {t('statsReport.realtime')}</span>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, padding: '0 0 12px' }}>
            <div style={{ padding: 14, background: COLORS.bgGray, borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: COLORS.primary }}>{weekly.totalExams}</div>
              <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 4 }}>{t('statsReport.totalExamsShort')}</div>
            </div>
            <div style={{ padding: 14, background: COLORS.bgGray, borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: COLORS.success }}>{weekly.totalReports}</div>
              <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 4 }}>{t('statsReport.totalReportsShort')}</div>
            </div>
            <div style={{ padding: 14, background: COLORS.bgGray, borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: COLORS.danger }}>{weekly.totalCritical}</div>
              <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 4 }}>{t('statsReport.criticalValues')}</div>
            </div>
            <div style={{ padding: 14, background: COLORS.bgGray, borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: COLORS.secondary }}>{weekly.avgExamsPerDay}</div>
              <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 4 }}>{t('statsReport.avgDailyExams')}</div>
            </div>
          </div>
          {weekly.daily.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, minHeight: 90, padding: '8px 4px 0' }}>
              {weekly.daily.slice(-7).map((d, i) => {
                const max = Math.max(...weekly.daily.map(x => x.count), 1)
                return (
                  <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: COLORS.textMuted }}>{d.count}</div>
                    <div style={{ height: 60, background: COLORS.bgGray, borderRadius: '4px 4px 0 0', display: 'flex', alignItems: 'flex-end', overflow: 'hidden' }}>
                      <div style={{ width: '100%', height: `${Math.max((d.count / max) * 100, 4)}%`, background: COLORS.primaryLight, borderRadius: '4px 4px 0 0' }} />
                    </div>
                    <div style={{ fontSize: 10, color: COLORS.textMuted, marginTop: 4 }}>{(d.date ?? '').slice(5)}</div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* [Wave1B P2] 模态分布: statsApi.getTopModalities (GET /stats/top-modalities) */}
      {topModalities.length > 0 && (
        <div style={{ ...styles.tableCard, marginBottom: 16 }}>
          <div style={styles.tableHeader}>
            <div style={styles.tableTitle}>
              <Radio size={18} /> {t('statsReport.modalityDistributionPrefix')}{topModalities.length})
              {topModalitiesLive && <span style={{ ...styles.badge, backgroundColor: COLORS.successLight, color: COLORS.success, marginLeft: 8 }}> {t('statsReport.realtime')}</span>}
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, padding: '14px 16px' }}>
            {topModalities.map((m: any, i: number) => {
              const count = Number(m.count ?? m.examCount ?? 0)
              const name = String(m.modality ?? m.name ?? `模态${i + 1}`)
              const max = Math.max(...topModalities.map((x: any) => Number(x.count ?? x.examCount ?? 0)), 1)
              const color = MODALITY_COLORS[name] || COLORS.primaryLight
              return (
                <div key={i} style={{ flex: '1 1 140px', minWidth: 130, padding: 10, background: COLORS.bgGray, borderRadius: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: color }}>{name}</span>
                    <span style={{ fontSize: 16, fontWeight: 800, color: COLORS.textDark }}>{count}</span>
                  </div>
                  <div style={{ height: 8, background: 'rgba(148,163,184,0.25)', borderRadius: 4, marginTop: 8, overflow: 'hidden' }}>
                    <div style={{ width: `${(count / max) * 100}%`, height: '100%', background: color, borderRadius: 4 }} />
                  </div>
                  <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 6 }}>{((count / max) * 100).toFixed(0)}% {t('statsReport.relativeHighest')}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* [G005 Wave1B] analyticsStatsApi: 预测趋势 / 设备利用率 / 报告准确率 (失败回退不阻断) */}
      {(analyticsLive || utilization || accuracy) && (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
          {/* 预测趋势小图 */}
          <div style={styles.tableCard}>
            <div style={styles.tableHeader}>
              <div style={styles.tableTitle}>
                <TrendingUp size={18} /> {t('statsReport.forecastTrend')}
                {analyticsLive && <span style={{ ...styles.badge, backgroundColor: COLORS.successLight, color: COLORS.success, marginLeft: 8 }}>{t('statsReport.forecast')}</span>}
              </div>
              <span style={{ fontSize: 12, color: COLORS.textMuted }}>{t('statsReport.forecastNote')}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, padding: '14px 16px', minHeight: 110 }}>
              {forecast.length > 0 && (() => {
                const max = Math.max(...forecast.map(p => Math.max(Number(p.actual) || 0, Number(p.forecast) || 0)), 1)
                return forecast.slice(-28).map((p, i) => {
                  const isForecast = p.actual == null || p.actual === 0
                  const val = Number(isForecast ? p.forecast : p.actual) || 0
                  return (
                    <div key={i} style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
                      <div style={{ fontSize: 10, color: COLORS.textMuted }}>{isForecast ? val : ''}</div>
                      <div style={{ height: 80, background: COLORS.bgGray, borderRadius: '4px 4px 0 0', display: 'flex', alignItems: 'flex-end', overflow: 'hidden' }}>
                        <div style={{
                          width: '100%',
                          height: `${Math.max((val / max) * 100, 3)}%`,
                          background: isForecast ? '#fbbf24' : COLORS.primaryLight,
                          opacity: isForecast ? 0.7 : 1,
                          borderTop: isForecast ? '2px dashed #d97706' : 'none',
                          borderRadius: '4px 4px 0 0',
                        }} />
                      </div>
                      <div style={{ fontSize: 9, color: COLORS.textMuted, marginTop: 4 }}>{(p.date ?? '').slice(5)}</div>
                    </div>
                  )
                })
              })()}
            </div>
          </div>

          {/* 设备利用率 */}
          {utilization && (
            <div style={styles.tableCard}>
              <div style={styles.tableHeader}>
                <div style={styles.tableTitle}>
                  <Gauge size={18} /> {t('statsReport.deviceUtilization')}
                  <span style={{ ...styles.badge, backgroundColor: COLORS.successLight, color: COLORS.success, marginLeft: 8 }}>{t('statsReport.utilization')}</span>
                </div>
              </div>
              <div style={{ padding: 16 }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: (utilization.current ?? 0) >= (utilization.target ?? 0) ? COLORS.success : COLORS.warning }}>
                  {(utilization.current ?? 0).toFixed(1)}%
                </div>
                <div style={{ height: 10, background: COLORS.bgGray, borderRadius: 5, overflow: 'hidden', marginTop: 10 }}>
                  <div style={{ width: `${Math.min((utilization.current ?? 0), (utilization.max ?? 100)) / ((utilization.max ?? 100) || 1) * 100}%`, height: '100%', background: COLORS.primaryLight, borderRadius: 5 }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: COLORS.textMuted, marginTop: 8 }}>
                  <span>{t('statsReport.targetPrefix')}{utilization.target ?? 0}%</span>
                  <span>{t('statsReport.upperLimitPrefix')}{utilization.max ?? 0}%</span>
                </div>
              </div>
            </div>
          )}

          {/* 报告准确率 */}
          {accuracy && (
            <div style={styles.tableCard}>
              <div style={styles.tableHeader}>
                <div style={styles.tableTitle}>
                  <Activity size={18} /> {t('statsReport.reportAccuracy')}
                  <span style={{ ...styles.badge, backgroundColor: COLORS.successLight, color: COLORS.success, marginLeft: 8 }}>{t('statsReport.accuracy')}</span>
                </div>
              </div>
              <div style={{ padding: 16 }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: COLORS.primary }}>{accuracy.value?.toFixed(1)}%</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, fontSize: 13, color: (accuracy.previous ?? 0) <= accuracy.value ? COLORS.success : COLORS.danger }}>
                  {accuracy.previous != null && (
                    <>
                      {(accuracy.previous ?? 0) <= accuracy.value ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
                      {t('statsReport.vsPreviousPrefix')}{accuracy.previous.toFixed(1)}% ({(accuracy.value - accuracy.previous).toFixed(1)}pp)
                    </>
                  )}
                </div>
                <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 8 }}>{t('statsReport.qcPassRate')}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 标签页切换 */}
      <div style={styles.mainContent}>
        <div style={styles.tabsContainer}>
          <button 
            style={{ ...styles.tab, ...(activeTab === 'device' ? styles.tabActive : {}) }}
            onClick={() => { setActiveTab('device'); setCurrentPage(1); setSelectedRows([]); }}
            onMouseEnter={(e) => activeTab !== 'device' && (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
            onMouseLeave={(e) => activeTab !== 'device' && (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <Monitor size={16} />
            {t('statsReport.tabDevice')}
          </button>
          <button 
            style={{ ...styles.tab, ...(activeTab === 'doctor' ? styles.tabActive : {}) }}
            onClick={() => { setActiveTab('doctor'); setCurrentPage(1); setSelectedRows([]); }}
            onMouseEnter={(e) => activeTab !== 'doctor' && (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
            onMouseLeave={(e) => activeTab !== 'doctor' && (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <User size={16} />
            {t('statsReport.tabDoctor')}
          </button>
          <button 
            style={{ ...styles.tab, ...(activeTab === 'date' ? styles.tabActive : {}) }}
            onClick={() => { setActiveTab('date'); setCurrentPage(1); setSelectedRows([]); }}
            onMouseEnter={(e) => activeTab !== 'date' && (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
            onMouseLeave={(e) => activeTab !== 'date' && (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <Calendar size={16} />
            {t('statsReport.tabDate')}
          </button>
        </div>

        {/* 工具栏 */}
        <div style={styles.toolbar}>
          <div style={styles.toolbarLeft}>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: COLORS.textMuted }} />
              <input 
                type="text" 
                placeholder={t('statsReport.searchPlaceholder')} 
                style={{ ...styles.searchInput, paddingLeft: '34px' }}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
            </div>
            
            {activeTab === 'device' && (
              <Select
                size="small"
                style={{ minWidth: 140 }}
                value={modalityFilter}
                onChange={(v) => setModalityFilter(v)}
                options={[
                  { value: 'all', label: t('statsReport.allModalities') },
                  { value: 'CT', label: 'CT' },
                  { value: 'MR', label: 'MR' },
                  { value: 'DR', label: 'DR' },
                  { value: '乳腺钼靶', label: '乳腺钼靶' },
                  { value: 'DSA', label: 'DSA' },
                  { value: 'CR', label: 'CR' },
                ]}
              />
            )}
            
            {activeTab === 'date' && (
              <Select
                size="small"
                style={{ minWidth: 140 }}
                value={dateRange}
                onChange={(v) => setDateRange(v)}
                options={[
                  { value: '7d', label: t('statsReport.last7d') },
                  { value: '30d', label: t('statsReport.last30d') },
                  { value: '90d', label: t('statsReport.last90d') },
                ]}
              />
            )}
            
            <ActionButton
              action="refresh"
              size="compact"
              onClick={() => { setSearchText(''); setModalityFilter('all'); setDateRange('7d'); }}
            >
              {t('statsReport.reset')}
            </ActionButton>
          </div>
          
          <div style={styles.toolbarRight}>
            <span style={{ fontSize: '13px', color: COLORS.textMuted }}>
              {t('statsReport.totalDataPrefix')}{filteredData.length} {t('statsReport.totalDataSuffix')}
              {selectedRows.length > 0 && ` · 已选择 ${selectedRows.length} 条`}
            </span>

            {/* [G005 Wave1B] 真实导出: GET /stats/export.csv (后端生成, 含 BOM 表头) */}
            <ActionButton
              action="export"
              size="compact"
              loading={exportingCsv}
              onClick={() => void handleRealExportCsv()}
            >
              {exportingCsv ? t('statsReport.exportingCsv') : t('statsReport.exportCsv')}
            </ActionButton>

            <ActionButton
              action="export"
              size="compact"
              onClick={() => setShowExportModal(true)}
            >
              {t('statsReport.export')}
            </ActionButton>
          </div>
          {csvNote && (
            <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckCircle size={13} color={COLORS.success} />
              {csvNote}
            </div>
          )}
        </div>

        {/* 数据表格 */}
        <div style={styles.tableCard}>
          <div style={styles.tableHeader}>
            <div style={styles.tableTitle}>
              {activeTab === 'device' && <><Monitor size={18} /> {t('statsReport.deviceReport')}</>}
              {activeTab === 'doctor' && <><User size={18} /> {t('statsReport.doctorReport')}</>}
              {activeTab === 'date' && <><Calendar size={18} /> {t('statsReport.dateReport')}</>}
              {isLive && (
                <span style={{ ...styles.badge, backgroundColor: COLORS.successLight, color: COLORS.success, marginLeft: 8 }}>
                  {t('statsReport.realtime')}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <ActionButton
                action="print"
                onClick={() => {
                  const printWindow = window.open('', '_blank')
                  if (printWindow) {
                    const headers = getHeaders()
                    const data = getFilteredData()
                    const rows = data.map(item => getRowValues(item))
                    
                    const tableHTML = `
                      <html>
                      <head>
                        <title>统计报表</title>
                        <style>
                          body { font-family: Arial, sans-serif; padding: 20px; }
                          h1 { color: #1e40af; }
                          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
                          th { background-color: #1e40af; color: white; }
                          tr:nth-child(even) { background-color: #f9f9f9; }
                        </style>
                      </head>
                      <body>
                        <h1>放射科统计报表</h1>
                        <p>报表类型：${activeTab === 'device' ? '按设备统计' : activeTab === 'doctor' ? '按医生统计' : '按日期统计'}</p>
                        <p>导出时间：${new Date().toLocaleString()}</p>
                        <table>
                          <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
                          ${rows.map(row => `<tr>${row.map(v => `<td>${v}</td>`).join('')}</tr>`).join('')}
                        </table>
                      </body>
                      </html>
                    `
                    
                    printWindow.document.write(tableHTML)
                    printWindow.document.close()
                    printWindow.print()
                  }
                }}
              >
                {t('statsReport.print')}
              </ActionButton>
            </div>
          </div>
          
          <table style={styles.table}>
            <thead style={styles.tableHead}>
              <tr>
                <th style={{ ...styles.th, width: '40px' }}>
                  <input 
                    type="checkbox" 
                    checked={selectedRows.length === getPaginatedData().length && getPaginatedData().length > 0}
                    onChange={toggleAllSelection}
                  />
                </th>
                {activeTab === 'device' && (
                  <>
                    <th style={styles.th}>{t('statsReport.thDeviceId')}</th>
                    <th style={styles.th}>{t('statsReport.thDeviceName')}</th>
                    <th style={styles.th}>{t('statsReport.thDeviceType')}</th>
                    <th style={styles.th}>{t('statsReport.thTotalExams')}</th>
                    <th style={styles.th}>{t('statsReport.thCompletedReports')}</th>
                    <th style={styles.th}>{t('statsReport.thPendingReports')}</th>
                    <th style={styles.th}>{t('statsReport.thCriticalCases')}</th>
                    <th style={styles.th}>{t('statsReport.thAvgReportTime')}</th>
                    <th style={styles.th}>{t('statsReport.thUtilization')}</th>
                  </>
                )}
                {activeTab === 'doctor' && (
                  <>
                    <th style={styles.th}>{t('statsReport.thDoctorId')}</th>
                    <th style={styles.th}>{t('statsReport.thDoctorName')}</th>
                    <th style={styles.th}>{t('statsReport.thDepartment')}</th>
                    <th style={styles.th}>{t('statsReport.thTitle')}</th>
                    <th style={styles.th}>{t('statsReport.thTotalReports')}</th>
                    <th style={styles.th}>{t('statsReport.thCompleted')}</th>
                    <th style={styles.th}>{t('statsReport.thPending')}</th>
                    <th style={styles.th}>{t('statsReport.thCriticalCases')}</th>
                    <th style={styles.th}>{t('statsReport.thAvgReportTime')}</th>
                    <th style={styles.th}>{t('statsReport.thAccuracy')}</th>
                  </>
                )}
                {activeTab === 'date' && (
                  <>
                    <th style={styles.th}>{t('statsReport.thDate')}</th>
                    <th style={styles.th}>{t('statsReport.thWeekday')}</th>
                    <th style={styles.th}>{t('statsReport.thTotalExams')}</th>
                    <th style={styles.th}>{t('statsReport.thCompletedReports')}</th>
                    <th style={styles.th}>{t('statsReport.thPendingReports')}</th>
                    <th style={styles.th}>{t('statsReport.thCriticalCases')}</th>
                    <th style={styles.th}>{t('statsReport.thRevenue')}</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {renderTableBody()}
            </tbody>
          </table>

          {isLive && (
            <div style={{ padding: '8px 16px', fontSize: 12, color: COLORS.textMuted, borderTop: '1px solid var(--border-light)', background: 'var(--bg-card)' }}>
              {t('statsReport.liveNote')}
            </div>
          )}
          
          {/* 分页 */}
          <div style={styles.pagination}>
            <div style={styles.paginationInfo}>
              {t('statsReport.showingPrefix')}{((currentPage - 1) * pageSize) + 1}{t('statsReport.showingMid')}{Math.min(currentPage * pageSize, filteredData.length)}{t('statsReport.showingSuffix')}{filteredData.length}{t('statsReport.showingEnd')}
            </div>
            <div style={styles.paginationButtons}>
              <button 
                style={{ ...styles.pageButton, ...(currentPage === 1 ? { opacity: 0.5, cursor: 'not-allowed' } : {}) }}
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(1)}
              >
                {t('statsReport.firstPage')}
              </button>
              <button 
                style={{ ...styles.pageButton, ...(currentPage === 1 ? { opacity: 0.5, cursor: 'not-allowed' } : {}) }}
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              >
                {t('statsReport.prevPage')}
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum
                if (totalPages <= 5) {
                  pageNum = i + 1
                } else if (currentPage <= 3) {
                  pageNum = i + 1
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i
                } else {
                  pageNum = currentPage - 2 + i
                }
                return (
                  <button 
                    key={pageNum}
                    style={{ ...styles.pageButton, ...(currentPage === pageNum ? styles.pageButtonActive : {}) }}
                    onClick={() => setCurrentPage(pageNum)}
                  >
                    {pageNum}
                  </button>
                )
              })}
              <button 
                style={{ ...styles.pageButton, ...(currentPage === totalPages ? { opacity: 0.5, cursor: 'not-allowed' } : {}) }}
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              >
                {t('statsReport.nextPage')}
              </button>
              <button 
                style={{ ...styles.pageButton, ...(currentPage === totalPages ? { opacity: 0.5, cursor: 'not-allowed' } : {}) }}
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(totalPages)}
              >
                {t('statsReport.lastPage')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 导出模态框 */}
      {showExportModal && (
        <div style={styles.modalOverlay} onClick={() => setShowExportModal(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div style={styles.modalTitle}>
                <Download size={18} />
                {t('statsReport.exportReport')}
              </div>
              <ActionButton
                action="cancel"
                variant="text"
                onClick={() => setShowExportModal(false)}
              />
            </div>
            <div style={styles.modalBody}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>{t('statsReport.exportScope')}</label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input 
                      type="radio" 
                      name="exportType" 
                      value="current"
                      checked={exportType === 'current'}
                      onChange={() => setExportType('current')}
                    />
                    {t('statsReport.currentFilteredPrefix')}{filteredData.length}{t('statsReport.currentFilteredSuffix')}
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input 
                      type="radio" 
                      name="exportType" 
                      value="all"
                      checked={exportType === 'all'}
                      onChange={() => setExportType('all')}
                    />
                    {t('statsReport.allDataPrefix')}{getTableData().length}{t('statsReport.currentFilteredSuffix')}
                  </label>
                </div>
              </div>
              
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>{t('statsReport.exportFormat')}</label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input 
                      type="radio" 
                      name="exportFormat" 
                      value="csv"
                      checked={exportFormat === 'csv'}
                      onChange={() => setExportFormat('csv')}
                    />
                    {t('statsReport.fmtCsv')}
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input 
                      type="radio" 
                      name="exportFormat" 
                      value="excel"
                      checked={exportFormat === 'excel'}
                      onChange={() => setExportFormat('excel')}
                    />
                    {t('statsReport.fmtExcel')}
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input 
                      type="radio" 
                      name="exportFormat" 
                      value="print"
                      checked={exportFormat === 'print'}
                      onChange={() => setExportFormat('print')}
                    />
                    {t('statsReport.fmtPrint')}
                  </label>
                </div>
              </div>
              
              <div style={{ 
                padding: '16px', 
                backgroundColor: 'var(--bg-card)', 
                borderRadius: '8px',
                border: '1px solid var(--border-color)'
              }}>
                <div style={{ fontSize: '13px', color: COLORS.textMuted, marginBottom: '8px' }}>
                  {t('statsReport.exportPreview')}
                </div>
                <div style={{ fontSize: '14px' }}>
                  <div><strong>{t('statsReport.reportType')}</strong>{activeTab === 'device' ? t('statsReport.tabDevice') : activeTab === 'doctor' ? t('statsReport.tabDoctor') : t('statsReport.tabDate')}</div>
                  <div><strong>{t('statsReport.dataScope')}</strong>{exportType === 'current' ? t('statsReport.currentFiltered') : t('statsReport.allData')}</div>
                  <div><strong>{t('statsReport.dataCount')}</strong>{exportType === 'current' ? filteredData.length : getTableData().length}{t('statsReport.showingEnd')}</div>
                  <div><strong>{t('statsReport.exportFormatLabel')}</strong>{exportFormat === 'csv' ? t('statsReport.csvComma') : exportFormat === 'excel' ? 'Excel (.xlsx)' : t('statsReport.fmtPrint')}</div>
                </div>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                <ActionButton
                  action="cancel"
                  onClick={() => setShowExportModal(false)}
                >
                  {t('statsReport.cancel')}
                </ActionButton>
                <ActionButton
                  action="export"
                  onClick={handleExport}
                >
                  {t('statsReport.confirmExport')}
                </ActionButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
