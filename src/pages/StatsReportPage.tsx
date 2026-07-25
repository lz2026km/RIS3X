// @ts-nocheck
// G005 放射RIS系统 - 数据统计报表页 v1.0.0
// 功能：多维度统计表格（按设备/按医生/按日期），报表导出功能
import { useState } from 'react'
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
  bgGray: '#f1f5f9',
  cardWhite: '#ffffff',
  textDark: '#1f2937',
  textMuted: '#6b7280',
  border: '#e5e7eb',
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
// 按设备统计
const deviceStatsData = [
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
const doctorStatsData = [
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
const dateStatsData = [
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
    border: '1px solid #e5e7eb',
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
    border: '1px solid #e5e7eb',
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
    border: '1px solid #e5e7eb',
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
    border: '1px solid #d1d5db',
    fontSize: '13px',
    width: '240px',
    outline: 'none',
  },
  selectInput: {
    padding: '8px 12px',
    borderRadius: '6px',
    border: '1px solid #d1d5db',
    fontSize: '13px',
    outline: 'none',
    backgroundColor: 'white',
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
    border: '1px solid #d1d5db',
    color: COLORS.textDark,
  },
  // 表格卡片
  tableCard: {
    backgroundColor: COLORS.cardWhite,
    borderRadius: '10px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    border: '1px solid #e5e7eb',
    overflow: 'hidden',
  },
  tableHeader: {
    padding: '16px 20px',
    borderBottom: '1px solid #e5e7eb',
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
    backgroundColor: '#f8fafc',
  },
  th: {
    padding: '12px 16px',
    textAlign: 'left',
    fontSize: '13px',
    fontWeight: 600,
    color: COLORS.textMuted,
    borderBottom: '1px solid #e5e7eb',
    whiteSpace: 'nowrap' as const,
  },
  td: {
    padding: '12px 16px',
    fontSize: '13px',
    borderBottom: '1px solid #f1f5f9',
    color: COLORS.textDark,
  },
  trHover: {
    backgroundColor: '#f8fafc',
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
    backgroundColor: '#dbeafe',
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
    borderTop: '1px solid #e5e7eb',
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
    border: '1px solid #d1d5db',
    backgroundColor: 'white',
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
    borderBottom: '1px solid #e5e7eb',
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
        return ['设备ID', '设备名称', '设备类型', '检查总数', '已完成报告', '待写报告', '危急病例', '平均报告时间(分钟)', '设备利用率(%)']
      case 'doctor':
        return ['医生ID', '医生姓名', '科室', '职称', '报告总数', '已完成', '待写', '危急病例', '平均报告时间(分钟)', '准确率(%)']
      case 'date':
        return ['日期', '星期', '检查总数', '已完成报告', '待写报告', '危急病例', '收入(元)']
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

  // 统计卡片数据
  const getSummaryStats = () => {
    const data = getTableData()
    
    if (activeTab === 'device') {
      const totalExams = data.reduce((sum, d: any) => sum + d.totalExams, 0)
      const totalReports = data.reduce((sum, d: any) => sum + d.completedReports, 0)
      const avgUtilization = data.reduce((sum, d: any) => sum + d.utilizationRate, 0) / data.length
      const criticalCases = data.reduce((sum, d: any) => sum + d.criticalCases, 0)
      
      return [
        { label: '设备总数', value: data.length, icon: <Monitor size={18} />, color: COLORS.primary },
        { label: '检查总量', value: totalExams.toLocaleString(), icon: <Scan size={18} />, color: COLORS.secondary },
        { label: '完成报告', value: totalReports.toLocaleString(), icon: <FileText size={18} />, color: COLORS.success },
        { label: '平均利用率', value: avgUtilization.toFixed(1) + '%', icon: <Gauge size={18} />, color: COLORS.warning },
        { label: '危急病例', value: criticalCases, icon: <AlertTriangle size={18} />, color: COLORS.danger },
      ]
    } else if (activeTab === 'doctor') {
      const totalReports = data.reduce((sum, d: any) => sum + d.totalReports, 0)
      const completedReports = data.reduce((sum, d: any) => sum + d.completedReports, 0)
      const avgAccuracy = data.reduce((sum, d: any) => sum + d.accuracy, 0) / data.length
      
      return [
        { label: '医生总数', value: data.length, icon: <User size={18} />, color: COLORS.primary },
        { label: '报告总量', value: totalReports.toLocaleString(), icon: <FileText size={18} />, color: COLORS.secondary },
        { label: '完成报告', value: completedReports.toLocaleString(), icon: <CheckCircle size={18} />, color: COLORS.success },
        { label: '平均准确率', value: avgAccuracy.toFixed(1) + '%', icon: <Activity size={18} />, color: COLORS.warning },
        { label: '待写报告', value: data.reduce((sum: number, d: any) => sum + d.pendingReports, 0), icon: <Clock size={18} />, color: COLORS.danger },
      ]
    } else {
      const totalExams = data.reduce((sum, d: any) => sum + d.totalExams, 0)
      const totalReports = data.reduce((sum, d: any) => sum + d.completedReports, 0)
      const totalRevenue = data.reduce((sum, d: any) => sum + d.revenue, 0)
      const totalCritical = data.reduce((sum, d: any) => sum + d.criticalCases, 0)
      
      return [
        { label: '统计天数', value: data.length, icon: <Calendar size={18} />, color: COLORS.primary },
        { label: '检查总量', value: totalExams.toLocaleString(), icon: <Scan size={18} />, color: COLORS.secondary },
        { label: '完成报告', value: totalReports.toLocaleString(), icon: <FileText size={18} />, color: COLORS.success },
        { label: '收入总计', value: (totalRevenue / 10000).toFixed(1) + '万', icon: <BarChart3 size={18} />, color: COLORS.warning },
        { label: '危急病例', value: totalCritical, icon: <AlertTriangle size={18} />, color: COLORS.danger },
      ]
    }
  }

  // 渲染表格内容
  const renderTableBody = () => {
    const data = getPaginatedData()
    
    if (activeTab === 'device') {
      return data.map((item: any, index) => (
        <tr 
          key={item.deviceId} 
          style={selectedRows.includes(item.deviceId) ? { backgroundColor: '#eff6ff' } : index % 2 === 0 ? {} : { backgroundColor: '#fafafa' }}
          onMouseEnter={(e) => !selectedRows.includes(item.deviceId) && (e.currentTarget.style.backgroundColor = '#f1f5f9')}
          onMouseLeave={(e) => selectedRows.includes(item.deviceId) ? (e.currentTarget.style.backgroundColor = '#eff6ff') : (e.currentTarget.style.backgroundColor = index % 2 === 0 ? 'transparent' : '#fafafa')}
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
          <td style={styles.td}>{item.avgReportTime}分钟</td>
          <td style={styles.td}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '100px', height: '8px', backgroundColor: '#e5e7eb', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${item.utilizationRate}%`, height: '100%', backgroundColor: item.utilizationRate > 90 ? COLORS.success : item.utilizationRate > 75 ? COLORS.warning : COLORS.danger }} />
              </div>
              <span style={{ fontSize: '12px', color: COLORS.textMuted }}>{item.utilizationRate}%</span>
            </div>
          </td>
        </tr>
      ))
    } else if (activeTab === 'doctor') {
      return data.map((item: any, index) => (
        <tr 
          key={item.doctorId} 
          style={selectedRows.includes(item.doctorId) ? { backgroundColor: '#eff6ff' } : index % 2 === 0 ? {} : { backgroundColor: '#fafafa' }}
          onMouseEnter={(e) => !selectedRows.includes(item.doctorId) && (e.currentTarget.style.backgroundColor = '#f1f5f9')}
          onMouseLeave={(e) => selectedRows.includes(item.doctorId) ? (e.currentTarget.style.backgroundColor = '#eff6ff') : (e.currentTarget.style.backgroundColor = index % 2 === 0 ? 'transparent' : '#fafafa')}
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
          <td style={styles.td}>{item.avgReportTime}分钟</td>
          <td style={styles.td}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '80px', height: '8px', backgroundColor: '#e5e7eb', borderRadius: '4px', overflow: 'hidden' }}>
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
          style={selectedRows.includes(item.date) ? { backgroundColor: '#eff6ff' } : index % 2 === 0 ? {} : { backgroundColor: '#fafafa' }}
          onMouseEnter={(e) => !selectedRows.includes(item.date) && (e.currentTarget.style.backgroundColor = '#f1f5f9')}
          onMouseLeave={(e) => selectedRows.includes(item.date) ? (e.currentTarget.style.backgroundColor = '#eff6ff') : (e.currentTarget.style.backgroundColor = index % 2 === 0 ? 'transparent' : '#fafafa')}
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
            数据统计报表
          </div>
          <div style={styles.headerSubtitle}>多维度统计报表 · 灵活查询 · 数据导出</div>
        </div>
        <div style={styles.headerActions}>
          <button 
            style={styles.headerBtn}
            onClick={() => setShowExportModal(true)}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.25)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.15)'}
          >
            <Download size={16} />
            导出报表
          </button>
        </div>
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

      {/* 标签页切换 */}
      <div style={styles.mainContent}>
        <div style={styles.tabsContainer}>
          <button 
            style={{ ...styles.tab, ...(activeTab === 'device' ? styles.tabActive : {}) }}
            onClick={() => { setActiveTab('device'); setCurrentPage(1); setSelectedRows([]); }}
            onMouseEnter={(e) => activeTab !== 'device' && (e.currentTarget.style.backgroundColor = '#f1f5f9')}
            onMouseLeave={(e) => activeTab !== 'device' && (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <Monitor size={16} />
            按设备统计
          </button>
          <button 
            style={{ ...styles.tab, ...(activeTab === 'doctor' ? styles.tabActive : {}) }}
            onClick={() => { setActiveTab('doctor'); setCurrentPage(1); setSelectedRows([]); }}
            onMouseEnter={(e) => activeTab !== 'doctor' && (e.currentTarget.style.backgroundColor = '#f1f5f9')}
            onMouseLeave={(e) => activeTab !== 'doctor' && (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <User size={16} />
            按医生统计
          </button>
          <button 
            style={{ ...styles.tab, ...(activeTab === 'date' ? styles.tabActive : {}) }}
            onClick={() => { setActiveTab('date'); setCurrentPage(1); setSelectedRows([]); }}
            onMouseEnter={(e) => activeTab !== 'date' && (e.currentTarget.style.backgroundColor = '#f1f5f9')}
            onMouseLeave={(e) => activeTab !== 'date' && (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <Calendar size={16} />
            按日期统计
          </button>
        </div>

        {/* 工具栏 */}
        <div style={styles.toolbar}>
          <div style={styles.toolbarLeft}>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: COLORS.textMuted }} />
              <input 
                type="text" 
                placeholder="搜索关键字..." 
                style={{ ...styles.searchInput, paddingLeft: '34px' }}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
            </div>
            
            {activeTab === 'device' && (
              <select 
                style={styles.selectInput}
                value={modalityFilter}
                onChange={(e) => setModalityFilter(e.target.value)}
              >
                <option value="all">全部设备类型</option>
                <option value="CT">CT</option>
                <option value="MR">MR</option>
                <option value="DR">DR</option>
                <option value="乳腺钼靶">乳腺钼靶</option>
                <option value="DSA">DSA</option>
                <option value="CR">CR</option>
              </select>
            )}
            
            {activeTab === 'date' && (
              <select 
                style={styles.selectInput}
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
              >
                <option value="7d">最近7天</option>
                <option value="30d">最近30天</option>
                <option value="90d">最近90天</option>
              </select>
            )}
            
            <button 
              style={{ ...styles.button, ...styles.buttonOutline }}
              onClick={() => { setSearchText(''); setModalityFilter('all'); setDateRange('7d'); }}
            >
              <RefreshCw size={14} />
              重置
            </button>
          </div>
          
          <div style={styles.toolbarRight}>
            <span style={{ fontSize: '13px', color: COLORS.textMuted }}>
              共 {filteredData.length} 条数据
              {selectedRows.length > 0 && ` · 已选择 ${selectedRows.length} 条`}
            </span>
            
            <button 
              style={{ ...styles.button, ...styles.buttonSuccess }}
              onClick={() => setShowExportModal(true)}
            >
              <Download size={14} />
              导出
            </button>
          </div>
        </div>

        {/* 数据表格 */}
        <div style={styles.tableCard}>
          <div style={styles.tableHeader}>
            <div style={styles.tableTitle}>
              {activeTab === 'device' && <><Monitor size={18} /> 设备统计报表</>}
              {activeTab === 'doctor' && <><User size={18} /> 医生工作量报表</>}
              {activeTab === 'date' && <><Calendar size={18} /> 日期统计报表</>}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                style={{ ...styles.button, ...styles.buttonOutline }}
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
                <Printer size={14} />
                打印
              </button>
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
                    <th style={styles.th}>设备ID</th>
                    <th style={styles.th}>设备名称</th>
                    <th style={styles.th}>设备类型</th>
                    <th style={styles.th}>检查总数</th>
                    <th style={styles.th}>已完成报告</th>
                    <th style={styles.th}>待写报告</th>
                    <th style={styles.th}>危急病例</th>
                    <th style={styles.th}>平均报告时间</th>
                    <th style={styles.th}>设备利用率</th>
                  </>
                )}
                {activeTab === 'doctor' && (
                  <>
                    <th style={styles.th}>医生ID</th>
                    <th style={styles.th}>医生姓名</th>
                    <th style={styles.th}>科室</th>
                    <th style={styles.th}>职称</th>
                    <th style={styles.th}>报告总数</th>
                    <th style={styles.th}>已完成</th>
                    <th style={styles.th}>待写</th>
                    <th style={styles.th}>危急病例</th>
                    <th style={styles.th}>平均报告时间</th>
                    <th style={styles.th}>准确率</th>
                  </>
                )}
                {activeTab === 'date' && (
                  <>
                    <th style={styles.th}>日期</th>
                    <th style={styles.th}>星期</th>
                    <th style={styles.th}>检查总数</th>
                    <th style={styles.th}>已完成报告</th>
                    <th style={styles.th}>待写报告</th>
                    <th style={styles.th}>危急病例</th>
                    <th style={styles.th}>收入</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {renderTableBody()}
            </tbody>
          </table>
          
          {/* 分页 */}
          <div style={styles.pagination}>
            <div style={styles.paginationInfo}>
              显示 {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, filteredData.length)} 条，共 {filteredData.length} 条
            </div>
            <div style={styles.paginationButtons}>
              <button 
                style={{ ...styles.pageButton, ...(currentPage === 1 ? { opacity: 0.5, cursor: 'not-allowed' } : {}) }}
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(1)}
              >
                首页
              </button>
              <button 
                style={{ ...styles.pageButton, ...(currentPage === 1 ? { opacity: 0.5, cursor: 'not-allowed' } : {}) }}
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              >
                上一页
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
                下一页
              </button>
              <button 
                style={{ ...styles.pageButton, ...(currentPage === totalPages ? { opacity: 0.5, cursor: 'not-allowed' } : {}) }}
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(totalPages)}
              >
                末页
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
                导出报表
              </div>
              <button style={styles.modalClose} onClick={() => setShowExportModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div style={styles.modalBody}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>导出范围</label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input 
                      type="radio" 
                      name="exportType" 
                      value="current"
                      checked={exportType === 'current'}
                      onChange={() => setExportType('current')}
                    />
                    当前筛选数据 ({filteredData.length} 条)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input 
                      type="radio" 
                      name="exportType" 
                      value="all"
                      checked={exportType === 'all'}
                      onChange={() => setExportType('all')}
                    />
                    全部数据 ({getTableData().length} 条)
                  </label>
                </div>
              </div>
              
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>导出格式</label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input 
                      type="radio" 
                      name="exportFormat" 
                      value="csv"
                      checked={exportFormat === 'csv'}
                      onChange={() => setExportFormat('csv')}
                    />
                    CSV 格式
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input 
                      type="radio" 
                      name="exportFormat" 
                      value="excel"
                      checked={exportFormat === 'excel'}
                      onChange={() => setExportFormat('excel')}
                    />
                    Excel 格式
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input 
                      type="radio" 
                      name="exportFormat" 
                      value="print"
                      checked={exportFormat === 'print'}
                      onChange={() => setExportFormat('print')}
                    />
                    打印预览
                  </label>
                </div>
              </div>
              
              <div style={{ 
                padding: '16px', 
                backgroundColor: '#f8fafc', 
                borderRadius: '8px',
                border: '1px solid #e5e7eb'
              }}>
                <div style={{ fontSize: '13px', color: COLORS.textMuted, marginBottom: '8px' }}>
                  导出预览
                </div>
                <div style={{ fontSize: '14px' }}>
                  <div><strong>报表类型：</strong>{activeTab === 'device' ? '按设备统计' : activeTab === 'doctor' ? '按医生统计' : '按日期统计'}</div>
                  <div><strong>数据范围：</strong>{exportType === 'current' ? '当前筛选数据' : '全部数据'}</div>
                  <div><strong>数据条数：</strong>{exportType === 'current' ? filteredData.length : getTableData().length} 条</div>
                  <div><strong>导出格式：</strong>{exportFormat === 'csv' ? 'CSV (逗号分隔)' : exportFormat === 'excel' ? 'Excel (.xlsx)' : '打印预览'}</div>
                </div>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                <button 
                  style={{ ...styles.button, ...styles.buttonOutline }}
                  onClick={() => setShowExportModal(false)}
                >
                  取消
                </button>
                <button 
                  style={{ ...styles.button, ...styles.buttonPrimary }}
                  onClick={handleExport}
                >
                  <Download size={14} />
                  确认导出
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
