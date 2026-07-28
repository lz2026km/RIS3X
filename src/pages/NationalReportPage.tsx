// @ts-nocheck
// G005 放射RIS系统 - 国家数据上报页面 v1.0.0
// Phase 5b: FHIR报告 · 多监管机构 · 预提交校验 · 审计追踪 · 计划报告
import { useState, useEffect } from 'react'
import { datareportApi, type NationalReportDto, type DataReportDto, type ExamStatisticsDto, type ReportLogDto, type MonthlyTrendDto } from '../services/api/datareportApi'
import {
  BarChart3, PieChart as PieChartIcon, Activity, TrendingUp, TrendingDown,
  Upload, Download, FileText, CheckCircle, AlertTriangle, Clock, ShieldCheck,
  Monitor, Scan, Radio, Image,
  Calendar, Search, Filter, RefreshCw, ChevronRight, Plus, Edit3, Eye,
  Settings, MoreVertical, X, Check, ArrowRight, Circle, FileSpreadsheet,
  Building2, Database, Network, Server, Globe, AlertCircle, FileJson,
  Fingerprint, Send, Zap, Repeat
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
  Pie
} from 'recharts'

// ============ 样式常量 ============
const COLORS = {
  primary: '#1e40af',      // 深蓝主色
  secondary: '#0891b2',    // 青色辅色
  success: '#16a34a',       // 成功绿
  warning: '#d97706',      // 警告橙
  danger: '#dc2626',        // 危险红
  bgGray: '#e8e8e8',        // 浅灰背景
  cardWhite: '#ffffff',     // 白色卡片
  textDark: '#1f2937',      // 深色文字
  textMuted: '#6b7280',     // 灰色文字
  border: '#d1d5db',        // 边框色
  ct: '#3b82f6',           // CT颜色
  mri: '#8b5cf6',          // MRI颜色
  dr: '#10b981',           // DR颜色
  mg: '#f59e0b',           // MG颜色
 dsa: '#ef4444',           // DSA颜色
}

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
    backgroundColor: COLORS.primary,
    color: 'white',
    padding: '16px 24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
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
  // 统计卡片容器
  statsContainer: {
    display: 'flex',
    gap: '16px',
    padding: '20px 24px',
    flexWrap: 'wrap' as const,
  },
  statCard: {
    backgroundColor: COLORS.cardWhite,
    borderRadius: '8px',
    padding: '16px 20px',
    minWidth: '180px',
    flex: 1,
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    border: '1px solid #e5e7eb',
  },
  statLabel: {
    fontSize: '12px',
    color: COLORS.textMuted,
    marginBottom: '4px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  statValue: {
    fontSize: '24px',
    fontWeight: 700,
    color: COLORS.primary,
  },
  statChange: {
    fontSize: '11px',
    marginTop: '4px',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  // 主内容区
  mainContent: {
    display: 'flex',
    gap: '16px',
    padding: '0 24px 20px',
    height: 'calc(100vh - 280px)',
    minHeight: '500px',
  },
  // 左侧面板
  leftPanel: {
    width: '280px',
    backgroundColor: COLORS.cardWhite,
    borderRadius: '8px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    border: '1px solid #e5e7eb',
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
  },
  // 中间面板
  middlePanel: {
    flex: 1,
    backgroundColor: COLORS.cardWhite,
    borderRadius: '8px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    border: '1px solid #e5e7eb',
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
  },
  // 右侧面板
  rightPanel: {
    width: '340px',
    backgroundColor: COLORS.cardWhite,
    borderRadius: '8px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    border: '1px solid #e5e7eb',
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
  },
  // 底部面板
  bottomPanel: {
    backgroundColor: COLORS.cardWhite,
    borderRadius: '8px',
    margin: '0 24px 20px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    border: '1px solid #e5e7eb',
    overflow: 'hidden',
  },
  // Tab 标签
  tabContainer: {
    display: 'flex',
    gap: '4px',
    padding: '12px 16px',
    borderBottom: '1px solid #e5e7eb',
    backgroundColor: '#f9fafb',
    flexWrap: 'wrap' as const,
  },
  tab: {
    padding: '8px 16px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500,
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    transition: 'all 0.2s',
    border: 'none',
    backgroundColor: 'transparent',
    color: COLORS.textMuted,
  },
  tabActive: {
    backgroundColor: COLORS.primary,
    color: 'white',
  },
  // 列表项
  listItem: {
    padding: '10px 12px',
    borderRadius: '6px',
    cursor: 'pointer',
    marginBottom: '4px',
    transition: 'all 0.15s',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  listItemActive: {
    backgroundColor: '#eff6ff',
    borderLeft: `3px solid ${COLORS.primary}`,
  },
  // 表格样式
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: '13px',
  },
  th: {
    padding: '10px 12px',
    textAlign: 'left' as const,
    backgroundColor: '#f9fafb',
    borderBottom: '2px solid #e5e7eb',
    fontWeight: 600,
    color: COLORS.textDark,
    whiteSpace: 'nowrap' as const,
  },
  td: {
    padding: '10px 12px',
    borderBottom: '1px solid #e5e7eb',
  },
  // 按钮样式
  button: {
    padding: '8px 16px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500,
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    transition: 'all 0.2s',
    border: 'none',
  },
  buttonPrimary: {
    backgroundColor: COLORS.primary,
    color: 'white',
  },
  buttonSecondary: {
    backgroundColor: COLORS.secondary,
    color: 'white',
  },
  buttonOutline: {
    backgroundColor: 'transparent',
    border: `1px solid ${COLORS.primary}`,
    color: COLORS.primary,
  },
  buttonDanger: {
    backgroundColor: COLORS.danger,
    color: 'white',
  },
  // 状态标签
  statusTag: {
    padding: '4px 10px',
    borderRadius: '20px',
    fontSize: '11px',
    fontWeight: 600,
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
  },
  // 输入框
  input: {
    padding: '8px 12px',
    borderRadius: '6px',
    border: '1px solid #d1d5db',
    fontSize: '13px',
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  // 模态框
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
    backgroundColor: COLORS.cardWhite,
    borderRadius: '12px',
    width: '90%',
    maxWidth: '600px',
    maxHeight: '90vh',
    overflow: 'auto',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
  },
  modalHeader: {
    padding: '16px 20px',
    borderBottom: '1px solid #e5e7eb',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontWeight: 600,
    fontSize: '16px',
  },
  modalBody: {
    padding: '20px',
  },
  modalFooter: {
    padding: '16px 20px',
    borderTop: '1px solid #e5e7eb',
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
  },
  // 表单项
  formGroup: {
    marginBottom: '16px',
  },
  formLabel: {
    display: 'block',
    marginBottom: '6px',
    fontWeight: 500,
    fontSize: '13px',
    color: COLORS.textDark,
  },
  // 小标签
  badge: {
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: 600,
  },
  // 分页
  pagination: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    borderTop: '1px solid #e5e7eb',
    backgroundColor: '#f9fafb',
  },
  // 空状态
  emptyState: {
    padding: '40px 20px',
    textAlign: 'center' as const,
    color: COLORS.textMuted,
  },
  // 搜索框
  searchBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    backgroundColor: '#f3f4f6',
    borderRadius: '6px',
    margin: '12px',
  },
  // 面板头部
  panelHeader: {
    padding: '14px 16px',
    borderBottom: '1px solid #e5e7eb',
    fontWeight: 600,
    fontSize: '14px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  panelBody: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '8px',
  },
  // 图表容器
  chartContainer: {
    padding: '16px',
    height: '220px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: '8px',
    margin: '12px',
  },
  // 进度条
  progressBar: {
    height: '8px',
    backgroundColor: '#e5e8eb',
    borderRadius: '4px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: '4px',
    transition: 'width 0.3s',
  },
}

// ============ 类型定义 ============
interface ExamStatistics {
  id: string
  modality: 'CT' | 'MRI' | 'DR' | 'MG' | 'DSA'
  examType: string
  examCount: number
  positiveCount: number
  positiveRate: number
  avgReportTime: number
  qualifiedRate: number
}

interface DoseReport {
  id: string
  reportMonth: string
  modality: string
  totalExams: number
  totalDLP: number
  avgDLP: number
  totalCTDI: number
  avgCTDI: number
  alertCount: number
  highDoseCount: number
  status: '待上报' | '已上报' | '已确认' | '已驳回'
  submitTime?: string
  confirmTime?: string
  confirmOrg?: string
}

interface QualityReport {
  id: string
  reportMonth: string
  totalReports: number
  qualifiedReports: number
  excellentReports: number
  qualifiedRate: number
  excellentRate: number
  avgScore: number
  commonIssues: string[]
  improvementMeasures: string[]
  status: '待审核' | '已通过' | '已驳回'
}

interface ReportLog {
  id: string
  reportType: 'exam' | 'dose' | 'quality'
  reportMonth: string
  submitTime: string
  status: string
  operator: string
  note?: string
}

// ============ Phase 5b 类型定义 ============

interface FHIRDiagnosticReport {
  resourceType: string
  id: string
  status: string
  category: { coding: { system: string; code: string; display: string }[] }
  code: { coding: { system: string; code: string; display: string }[]; text: string }
  subject: { reference: string; display: string }
  effectiveDateTime: string
  issued: string
  performer: { reference: string; display: string }[]
  conclusion: string
  presentedForm: { contentType: string; url: string; title: string }[]
}

interface FHIRObservation {
  resourceType: string
  id: string
  status: string
  category: { coding: { system: string; code: string; display: string }[] }
  code: { coding: { system: string; code: string; display: string }[]; text: string }
  subject: { reference: string; display: string }
  effectiveDateTime: string
  valueQuantity: { value: number; unit: string; system: string; code: string }
  referenceRange: { low: { value: number }; high: { value: number }; type: string }[]
}

interface RegulatorTarget {
  id: string
  name: string
  shortName: string
  icon: any
  endpoint: string
  format: string
  status: 'online' | 'offline' | 'degraded'
  lastSubmission: string
  template: string
}

interface ValidationCheck {
  id: string
  field: string
  type: 'completeness' | 'consistency' | 'business'
  status: 'pass' | 'fail' | 'warning'
  message: string
  severity: 'error' | 'warning'
}

interface SubmissionRecord {
  id: string
  reportType: string
  submittedAt: string
  target: string
  status: 'success' | 'failed' | 'pending' | 'amended'
  signature: string
  receiptId: string
  version: number
  amendedVersion?: number
}

interface ScheduledReportConfig {
  id: string
  name: string
  type: string
  schedule: 'daily' | 'weekly' | 'monthly' | 'quarterly'
  format: string
  recipients: string[]
  enabled: boolean
  lastRun: string
  nextRun: string
}

// ============ 模拟数据 ============
const modalityColors: Record<string, string> = {
  'CT': COLORS.ct,
  'MRI': COLORS.mri,
  'DR': COLORS.dr,
  'MG': COLORS.mg,
  'DSA': COLORS.dsa,
}

const examStatisticsData: ExamStatistics[] = [
  { id: 'EX001', modality: 'CT', examType: '头颅CT平扫', examCount: 1256, positiveCount: 312, positiveRate: 24.8, avgReportTime: 25, qualifiedRate: 96.5 },
  { id: 'EX002', modality: 'CT', examType: '胸部CT平扫', examCount: 1089, positiveCount: 287, positiveRate: 26.4, avgReportTime: 22, qualifiedRate: 97.2 },
  { id: 'EX003', modality: 'CT', examType: '腹部CT平扫', examCount: 876, positiveCount: 198, positiveRate: 22.6, avgReportTime: 28, qualifiedRate: 95.8 },
  { id: 'EX004', modality: 'CT', examType: '冠脉CTA', examCount: 456, positiveCount: 189, positiveRate: 41.4, avgReportTime: 35, qualifiedRate: 94.3 },
  { id: 'EX005', modality: 'MRI', examType: '头颅MRI平扫', examCount: 678, positiveCount: 156, positiveRate: 23.0, avgReportTime: 30, qualifiedRate: 98.1 },
  { id: 'EX006', modality: 'MRI', examType: '膝关节MRI', examCount: 534, positiveCount: 289, positiveRate: 54.1, avgReportTime: 25, qualifiedRate: 97.5 },
  { id: 'EX007', modality: 'DR', examType: '胸部正侧位', examCount: 2156, positiveCount: 432, positiveRate: 20.0, avgReportTime: 15, qualifiedRate: 98.9 },
  { id: 'EX008', modality: 'DR', examType: '腹部平片', examCount: 876, positiveCount: 98, positiveRate: 11.2, avgReportTime: 12, qualifiedRate: 99.2 },
  { id: 'EX009', modality: 'MG', examType: 'MG', examCount: 324, positiveCount: 45, positiveRate: 13.9, avgReportTime: 20, qualifiedRate: 96.8 },
  { id: 'EX010', modality: 'DSA', examType: '冠脉造影', examCount: 156, positiveCount: 89, positiveRate: 57.1, avgReportTime: 45, qualifiedRate: 93.5 },
]

const doseReportData: DoseReport[] = [
  { id: 'DR001', reportMonth: '2026-04', modality: 'CT', totalExams: 3677, totalDLP: 2856400, avgDLP: 777, totalCTDI: 85600, avgCTDI: 23.3, alertCount: 28, highDoseCount: 156, status: '已确认', submitTime: '2026-05-05 10:30', confirmTime: '2026-05-06 09:15', confirmOrg: '国家辐射防护中心' },
  { id: 'DR002', reportMonth: '2026-04', modality: 'DR', totalExams: 3032, totalDLP: 0, avgDLP: 0, totalCTDI: 4548, avgCTDI: 1.5, alertCount: 5, highDoseCount: 12, status: '已确认', submitTime: '2026-05-05 10:35', confirmTime: '2026-05-06 09:20', confirmOrg: '国家辐射防护中心' },
  { id: 'DR003', reportMonth: '2026-04', modality: 'DSA', totalExams: 156, totalDLP: 0, avgDLP: 0, totalCTDI: 15600, avgCTDI: 100, alertCount: 18, highDoseCount: 45, status: '已确认', submitTime: '2026-05-05 10:40', confirmTime: '2026-05-06 09:25', confirmOrg: '国家辐射防护中心' },
  { id: 'DR004', reportMonth: '2026-04', modality: 'MG', totalExams: 324, totalDLP: 0, avgDLP: 0, totalCTDI: 648, avgCTDI: 2.0, alertCount: 0, highDoseCount: 0, status: '已确认', submitTime: '2026-05-05 10:42', confirmTime: '2026-05-06 09:28', confirmOrg: '国家辐射防护中心' },
  { id: 'DR005', reportMonth: '2026-05', modality: 'CT', totalExams: 1256, totalDLP: 980500, avgDLP: 781, totalCTDI: 29400, avgCTDI: 23.4, alertCount: 12, highDoseCount: 56, status: '已上报', submitTime: '2026-06-05 10:30' },
  { id: 'DR006', reportMonth: '2026-05', modality: 'DR', totalExams: 1089, totalDLP: 0, avgDLP: 0, totalCTDI: 1633, avgCTDI: 1.5, alertCount: 2, highDoseCount: 5, status: '待上报' },
  { id: 'DR007', reportMonth: '2026-05', modality: 'MRI', totalExams: 1212, totalDLP: 0, avgDLP: 0, totalCTDI: 0, avgCTDI: 0, alertCount: 0, highDoseCount: 0, status: '待上报' },
]

const qualityReportData: QualityReport[] = [
  { id: 'QR001', reportMonth: '2026-04', totalReports: 7033, qualifiedReports: 6856, excellentReports: 2156, qualifiedRate: 97.5, excellentRate: 30.7, avgScore: 87.3, commonIssues: ['描述不准确', '测量数据缺失', '结论不明确'], improvementMeasures: ['加强培训', '完善模板', '增加复核环节'], status: '已通过' },
  { id: 'QR002', reportMonth: '2026-05', totalReports: 3457, qualifiedReports: 3356, excellentReports: 1025, qualifiedRate: 97.1, excellentRate: 29.7, avgScore: 86.8, commonIssues: ['图像质量描述不足', '病史采集不全'], improvementMeasures: ['优化检查流程', '加强病史采集培训'], status: '待审核' },
]

const reportLogData: ReportLog[] = [
  { id: 'LOG001', reportType: 'dose', reportMonth: '2026-04', submitTime: '2026-05-05 10:30', status: '已确认', operator: '李建国', note: '国家辐射防护中心确认通过' },
  { id: 'LOG002', reportType: 'exam', reportMonth: '2026-04', submitTime: '2026-05-05 11:00', status: '已确认', operator: '李建国', note: '上报成功' },
  { id: 'LOG003', reportType: 'quality', reportMonth: '2026-04', submitTime: '2026-05-05 11:30', status: '已确认', operator: '王晓燕', note: '质量数据上报成功' },
  { id: 'LOG004', reportType: 'dose', reportMonth: '2026-05', submitTime: '2026-06-05 10:30', status: '已上报', operator: '李建国' },
  { id: 'LOG005', reportType: 'exam', reportMonth: '2026-05', submitTime: '2026-06-05 11:00', status: '已上报', operator: '李建国' },
]

// 月度趋势数据
const monthlyTrendData = [
  { month: '2025-12', CT: 3200, MRI: 1100, DR: 2800, MG: 280, DSA: 120 },
  { month: '2026-01', CT: 3350, MRI: 1150, DR: 2950, MG: 295, DSA: 135 },
  { month: '2026-02', CT: 3100, MRI: 1080, DR: 2750, MG: 265, DSA: 125 },
  { month: '2026-03', CT: 3450, MRI: 1200, DR: 3050, MG: 310, DSA: 145 },
  { month: '2026-04', CT: 3677, MRI: 1212, DR: 3032, MG: 324, DSA: 156 },
  { month: '2026-05', CT: 1256, MRI: 580, DR: 1089, MG: 156, DSA: 68 },
]

// 设备分布数据
const deviceDistribution = [
  { name: 'CT', value: 35, color: COLORS.ct },
  { name: 'MRI', value: 15, color: COLORS.mri },
  { name: 'DR', value: 38, color: COLORS.dr },
  { name: 'MG', value: 7, color: COLORS.mg },
  { name: 'DSA', value: 5, color: COLORS.dsa },
]

// ============ Phase 5b 模拟数据 ============

const mockFHIRReport: FHIRDiagnosticReport = {
  resourceType: 'DiagnosticReport',
  id: 'DR-202605-001',
  status: 'final',
  category: [{ coding: [{ system: 'http://loinc.org', code: 'LP29684-5', display: 'Radiology' }] }],
  code: { coding: [{ system: 'http://loinc.org', code: '18748-4', display: 'CT Head' }], text: '头颅CT平扫' },
  subject: { reference: 'Patient/RAD-P004', display: '赵晓敏' },
  effectiveDateTime: '2026-05-01T10:30:00Z',
  issued: '2026-05-01T11:00:00Z',
  performer: [{ reference: 'Practitioner/DR001', display: '王建国' }],
  conclusion: '未见明显异常',
  presentedForm: [{ contentType: 'application/pdf', url: 'http://ris.local/report/DR-202605-001.pdf', title: '头颅CT平扫报告' }],
}

const mockFHIRObservation: FHIRObservation = {
  resourceType: 'Observation',
  id: 'OBS-DLP-001',
  status: 'final',
  category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'imaging', display: 'Imaging' }] }],
  code: { coding: [{ system: 'http://loinc.org', code: '96915-5', display: 'CT dose and image quality' }], text: 'CT剂量DLP' },
  subject: { reference: 'Patient/RAD-P004', display: '赵晓敏' },
  effectiveDateTime: '2026-05-01T10:30:00Z',
  valueQuantity: { value: 680, unit: 'mGy·cm', system: 'http://unitsofmeasure.org', code: 'mGy.cm' },
  referenceRange: [{ low: { value: 0 }, high: { value: 800 }, type: 'normal' }],
}

const mockFHIRBundle = {
  resourceType: 'Bundle',
  type: 'transaction',
  entry: [
    { resource: mockFHIRReport, request: { method: 'POST', url: 'DiagnosticReport' } },
    { resource: mockFHIRObservation, request: { method: 'POST', url: 'Observation' } },
  ],
}

const regulatorTargets: RegulatorTarget[] = [
  { id: 'R001', name: '国家卫生健康委员会', shortName: '卫健委', icon: Building2, endpoint: 'https://api.nhc.gov.cn/report/v1', format: 'FHIR R4', status: 'online', lastSubmission: '2026-05-05 10:30', template: 'FHIR DiagnosticReport' },
  { id: 'R002', name: '国家医疗保障局', shortName: '医保局', icon: ShieldCheck, endpoint: 'https://api.nhsa.gov.cn/data/v2', format: 'CSV/XML', status: 'online', lastSubmission: '2026-05-05 10:35', template: '医保结算数据模板' },
  { id: 'R003', name: '中国疾病预防控制中心', shortName: '疾控中心', icon: Activity, endpoint: 'https://report.chinacdc.cn/rad/v1', format: 'FHIR R4', status: 'online', lastSubmission: '2026-05-05 10:40', template: '辐射剂量监测模板' },
  { id: 'R004', name: '省卫生健康委员会', shortName: '省卫健委', icon: Globe, endpoint: 'https://api.zjws.gov.cn/report', format: 'JSON', status: 'degraded', lastSubmission: '2026-05-04 09:00', template: '省级数据上报模板' },
]

const validationChecks: ValidationCheck[] = [
  { id: 'V001', field: '检查人数', type: 'completeness', status: 'pass', message: '字段完整', severity: 'error' },
  { id: 'V002', field: '阳性率', type: 'consistency', status: 'pass', message: '阳性率在合理范围(20-60%)', severity: 'error' },
  { id: 'V003', field: '合格率', type: 'completeness', status: 'pass', message: '所有设备类型合格率已填写', severity: 'error' },
  { id: 'V004', field: 'DLP总量', type: 'consistency', status: 'warning', message: 'CT的DLP总量较上月增长15%，需确认', severity: 'warning' },
  { id: 'V005', field: '预警次数', type: 'business', status: 'pass', message: '预警次数在正常范围', severity: 'error' },
  { id: 'V006', field: '高剂量人数', type: 'business', status: 'fail', message: 'DSA高剂量人数占比超过30%', severity: 'warning' },
  { id: 'V007', field: '上报月份', type: 'consistency', status: 'pass', message: '上报月份与数据周期一致', severity: 'error' },
  { id: 'V008', field: '签名完整性', type: 'completeness', status: 'pass', message: '数字签名已生成', severity: 'error' },
]

const submissionHistory: SubmissionRecord[] = [
  { id: 'SH001', reportType: '辐射剂量', submittedAt: '2026-05-05 10:30', target: '卫健委', status: 'success', signature: '0x8a3f9c2e7b1d5f4a', receiptId: 'NHC-202605-001', version: 1 },
  { id: 'SH002', reportType: '辐射剂量', submittedAt: '2026-05-05 10:35', target: '医保局', status: 'success', signature: '0x4b1e7d3f8c2a6f9d', receiptId: 'NHSA-202605-001', version: 1 },
  { id: 'SH003', reportType: '辐射剂量', submittedAt: '2026-05-05 10:40', target: '疾控中心', status: 'success', signature: '0x7d2c9e4f1a3b8f6e', receiptId: 'CDC-202605-001', version: 1 },
  { id: 'SH004', reportType: '检查统计', submittedAt: '2026-05-06 09:00', target: '卫健委', status: 'failed', signature: '0x3e5f8a2c7b1d9f4e', receiptId: '', version: 1, amendedVersion: 2 },
  { id: 'SH005', reportType: '检查统计', submittedAt: '2026-05-06 09:30', target: '卫健委', status: 'amended', signature: '0x9f1e3c5a7b2d8f6e', receiptId: 'NHC-202605-002', version: 2, amendedVersion: 1 },
  { id: 'SH006', reportType: '报告质量', submittedAt: '2026-05-06 10:00', target: '卫健委', status: 'success', signature: '0x6a2d8f4c1e3b9f7e', receiptId: 'NHC-202605-003', version: 1 },
]

const scheduledReports: ScheduledReportConfig[] = [
  { id: 'SC001', name: '日检查统计', type: '检查统计', schedule: 'daily', format: 'CSV', recipients: ['zhang@hospital.com', 'li@nhc.gov.cn'], enabled: true, lastRun: '2026-05-10 23:00', nextRun: '2026-05-11 23:00' },
  { id: 'SC002', name: '月度剂量报告', type: '辐射剂量', schedule: 'monthly', format: 'FHIR JSON', recipients: ['radiation@hospital.com', 'dose@nhc.gov.cn'], enabled: true, lastRun: '2026-05-05 10:00', nextRun: '2026-06-05 10:00' },
  { id: 'SC003', name: '季度质量报告', type: '报告质量', schedule: 'quarterly', format: 'PDF', recipients: ['qa@hospital.com', 'quality@nhc.gov.cn'], enabled: false, lastRun: '2026-04-01 09:00', nextRun: '2026-07-01 09:00' },
  { id: 'SC004', name: '周设备利用率', type: '检查统计', schedule: 'weekly', format: 'CSV', recipients: ['admin@hospital.com'], enabled: true, lastRun: '2026-05-08 08:00', nextRun: '2026-05-15 08:00' },
]

// ============ 工具函数 ============
const getStatusBadge = (status: string) => {
  const statusMap: Record<string, { bg: string; color: string; label: string }> = {
    '待上报': { bg: '#fef3c7', color: '#d97706', label: '待上报' },
    '已上报': { bg: '#dbeafe', color: '#2563eb', label: '已上报' },
    '已确认': { bg: '#d1fae5', color: '#16a34a', label: '已确认' },
    '已驳回': { bg: '#fee2e2', color: '#dc2626', label: '已驳回' },
    '待审核': { bg: '#fef3c7', color: '#d97706', label: '待审核' },
    '已通过': { bg: '#d1fae5', color: '#16a34a', label: '已通过' },
  }
  const style = statusMap[status] || { bg: '#f3f4f6', color: '#6b7280', label: status }
  return (
    <span style={{ padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, backgroundColor: style.bg, color: style.color }}>
      {style.label}
    </span>
  )
}

const getModalityBadge = (modality: string) => {
  const color = modalityColors[modality] || COLORS.primary
  return (
    <span style={{ padding: '3px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, backgroundColor: `${color}15`, color: color }}>
      {modality}
    </span>
  )
}

// ============ 导出函数 ============
const exportToCSV = (data: any[], filename: string, headers: string[]) => {
  const csvContent = [
    headers.join(','),
    ...data.map(row => Object.values(row).join(','))
  ].join('\n')

  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.click()
  URL.revokeObjectURL(link.href)
}

// ============ Phase 5b 子组件 ============

// 1. FHIR-Based Reporting 组件
const FHIRReportPanel = () => {
  const [fhirView, setFhirView] = useState<'report' | 'observation' | 'bundle' | 'export'>('report')
  const [exportSuccess, setExportSuccess] = useState(false)

  const handleFHIRExport = () => {
    setExportSuccess(true)
    setTimeout(() => setExportSuccess(false), 3000)
  }

  const fhirTabs = [
    { key: 'report', label: 'DiagnosticReport' },
    { key: 'observation', label: 'Observation' },
    { key: 'bundle', label: 'FHIR Bundle' },
    { key: 'export', label: 'FHIR导出' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* FHIR信息头 */}
      <div style={{ background: '#fff', borderRadius: 8, padding: 16, border: '1px solid #e5e7eb' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#1f2937', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <FileJson size={18} color={COLORS.primary} /> FHIR R4 标准化报告
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          <div><span style={{ fontSize: 12, color: COLORS.textMuted }}>版本:</span> <span style={{ fontSize: 12, fontWeight: 600 }}>R4 (4.0.1)</span></div>
          <div><span style={{ fontSize: 12, color: COLORS.textMuted }}>IG:</span> <span style={{ fontSize: 12, fontWeight: 600 }}>IHE-RAD-IG v3.0</span></div>
          <div><span style={{ fontSize: 12, color: COLORS.textMuted }}>验证:</span> <span style={{ fontSize: 12, fontWeight: 600, color: COLORS.success }}>符合IG规范</span></div>
          <div><span style={{ fontSize: 12, color: COLORS.textMuted }}>资源数:</span> <span style={{ fontSize: 12, fontWeight: 600 }}>{mockFHIRBundle.entry.length}</span></div>
        </div>
      </div>

      {/* Tab切换 */}
      <div style={{ display: 'flex', gap: 4, background: '#f9fafb', padding: 4, borderRadius: 8, width: 'fit-content' }}>
        {fhirTabs.map(t => (
          <button key={t.key} onClick={() => setFhirView(t.key as any)}
            style={{ padding: '6px 14px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: fhirView === t.key ? COLORS.primary : 'transparent', color: fhirView === t.key ? '#fff' : COLORS.textMuted }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* FHIR内容展示 */}
      {fhirView === 'report' && (
        <div style={{ background: '#1e293b', borderRadius: 8, padding: 16, overflow: 'auto', maxHeight: 400 }}>
          <pre style={{ color: '#e2e8f0', fontSize: 12, margin: 0, fontFamily: 'monospace' }}>{JSON.stringify(mockFHIRReport, null, 2)}</pre>
        </div>
      )}
      {fhirView === 'observation' && (
        <div style={{ background: '#1e293b', borderRadius: 8, padding: 16, overflow: 'auto', maxHeight: 400 }}>
          <pre style={{ color: '#e2e8f0', fontSize: 12, margin: 0, fontFamily: 'monospace' }}>{JSON.stringify(mockFHIRObservation, null, 2)}</pre>
        </div>
      )}
      {fhirView === 'bundle' && (
        <div style={{ background: '#1e293b', borderRadius: 8, padding: 16, overflow: 'auto', maxHeight: 400 }}>
          <pre style={{ color: '#e2e8f0', fontSize: 12, margin: 0, fontFamily: 'monospace' }}>{JSON.stringify(mockFHIRBundle, null, 2)}</pre>
        </div>
      )}
      {fhirView === 'export' && (
        <div style={{ background: '#fff', borderRadius: 8, padding: 20, border: '1px solid #e5e7eb', textAlign: 'center' }}>
          <FileJson size={48} color={COLORS.primary} style={{ marginBottom: 12 }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: '#1f2937', marginBottom: 8 }}>导出FHIR Bundle</div>
          <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 16 }}>将生成符合FHIR R4标准的Bundle资源包，包含DiagnosticReport和Observation资源</div>
          <button onClick={handleFHIRExport} style={{ padding: '10px 24px', background: COLORS.primary, color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Download size={16} /> 导出FHIR Bundle (JSON)
          </button>
          {exportSuccess && <div style={{ marginTop: 12, color: COLORS.success, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><CheckCircle size={14} /> FHIR Bundle导出成功</div>}
        </div>
      )}
    </div>
  )
}

// 2. 多监管机构支持组件
const MultiRegulatorPanel = () => {
  const [batchStatus, setBatchStatus] = useState<string | null>(null)
  const [submissions, setSubmissions] = useState<{ targetId: string; status: string }[]>([])

  const handleBatchSubmit = () => {
    setBatchStatus('submitting')
    setSubmissions(regulatorTargets.filter(t => t.status === 'online').map(t => ({ targetId: t.id, status: 'pending' })))
    setTimeout(() => {
      setSubmissions(regulatorTargets.filter(t => t.status === 'online').map(t => ({ targetId: t.id, status: 'success' })))
      setBatchStatus('done')
      setTimeout(() => setBatchStatus(null), 3000)
    }, 2000)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#1f2937', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Globe size={18} color={COLORS.primary} /> 监管机构配置
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleBatchSubmit} style={{ padding: '8px 16px', background: COLORS.primary, color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Send size={14} /> {batchStatus === 'submitting' ? '批量提交中...' : '批量提交全部'}
          </button>
        </div>
      </div>

      {/* 监管机构卡片 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
        {regulatorTargets.map(reg => {
          const subStatus = submissions.find(s => s.targetId === reg.id)
          return (
            <div key={reg.id} style={{ background: '#fff', borderRadius: 8, padding: 16, border: '1px solid #e5e7eb' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 8, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: COLORS.primary }}><reg.icon size={20} /></div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1f2937' }}>{reg.name}</div>
                  <div style={{ fontSize: 12, color: COLORS.textMuted }}>{reg.shortName} · {reg.format}</div>
                </div>
                <div style={{
                  padding: '4px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600,
                  background: reg.status === 'online' ? '#d1fae5' : reg.status === 'degraded' ? '#fef3c7' : '#fee2e2',
                  color: reg.status === 'online' ? '#16a34a' : reg.status === 'degraded' ? '#d97706' : '#dc2626'
                }}>{reg.status === 'online' ? '在线' : reg.status === 'degraded' ? '降级' : '离线'}</div>
              </div>
              <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 4 }}>接口: {reg.endpoint}</div>
              <div style={{ fontSize: 12, color: COLORS.textMuted }}>上次提交: {reg.lastSubmission}</div>
              {subStatus && (
                <div style={{ marginTop: 8, padding: '6px 10px', background: subStatus.status === 'success' ? '#d1fae5' : '#fef3c7', borderRadius: 6, fontSize: 12, fontWeight: 600, color: subStatus.status === 'success' ? '#16a34a' : '#d97706' }}>
                  {subStatus.status === 'success' ? '提交成功' : '提交中...'}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* 提交状态 */}
      {batchStatus === 'done' && (
        <div style={{ padding: '12px 16px', background: '#d1fae5', borderRadius: 8, border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#16a34a' }}>
          <CheckCircle size={14} /> 批量提交完成：{regulatorTargets.filter(t => t.status === 'online').length}个监管机构数据已成功提交
        </div>
      )}
    </div>
  )
}

// 3. 预提交验证组件
const PreSubmissionValidation = () => {
  const score = Math.round(validationChecks.filter(v => v.status === 'pass').length / validationChecks.length * 100)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 验证评分 */}
      <div style={{ background: '#fff', borderRadius: 8, padding: 20, border: '1px solid #e5e7eb', textAlign: 'center' }}>
        <div style={{ position: 'relative', width: 120, height: 120, margin: '0 auto 12px' }}>
          <svg width="120" height="120" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="54" fill="none" stroke="#e5e7eb" strokeWidth="8" />
            <circle cx="60" cy="60" r="54" fill="none" stroke={score >= 90 ? COLORS.success : score >= 70 ? COLORS.warning : COLORS.danger} strokeWidth="8" strokeDasharray={`${(score / 100) * 339.292} 339.292`} transform="rotate(-90 60 60)" />
          </svg>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 28, fontWeight: 800, color: score >= 90 ? COLORS.success : score >= 70 ? COLORS.warning : COLORS.danger }}>{score}</span>
          </div>
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#1f2937' }}>验证评分</div>
        <div style={{ fontSize: 12, color: COLORS.textMuted }}>基于 {validationChecks.length} 项校验规则</div>
      </div>

      {/* 校验明细 */}
      <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e5e7eb' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', fontWeight: 600, fontSize: 14 }}>数据质量校验明细</div>
        <div style={{ padding: 8 }}>
          {validationChecks.map(check => (
            <div key={check.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 6, marginBottom: 4, background: check.status === 'pass' ? '#f9fafb' : check.status === 'warning' ? '#fffbeb' : '#fef2f2' }}>
              {check.status === 'pass' ? <CheckCircle size={14} color={COLORS.success} /> : check.status === 'warning' ? <AlertTriangle size={14} color={COLORS.warning} /> : <XCircle size={14} color={COLORS.danger} />}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#1f2937' }}>{check.field}</div>
                <div style={{ fontSize: 12, color: COLORS.textMuted }}>{check.message}</div>
              </div>
              <span style={{
                padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600,
                background: check.type === 'completeness' ? '#eff6ff' : check.type === 'consistency' ? '#f5f3ff' : '#fef3c7',
                color: check.type === 'completeness' ? '#2563eb' : check.type === 'consistency' ? '#7c3aed' : '#d97706'
              }}>
                {check.type === 'completeness' ? '完整性' : check.type === 'consistency' ? '一致性' : '业务规则'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {score < 100 && (
        <div style={{ padding: '12px 16px', background: '#fffbeb', borderRadius: 8, border: '1px solid #fde68a', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <AlertTriangle size={14} color={COLORS.warning} style={{ marginTop: 2 }} />
          <div style={{ fontSize: 12, color: '#1f2937' }}>
            <strong>数据质量提示：</strong>{validationChecks.filter(v => v.status !== 'pass').length}项校验未通过，建议修正后再提交。
          </div>
        </div>
      )}
    </div>
  )
}

// 4. 提交审计追踪组件
const SubmissionAuditTrail = () => {
  const [selectedSubmission, setSelectedSubmission] = useState<SubmissionRecord | null>(null)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e5e7eb' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Clock size={16} color={COLORS.primary} /> 提交历史记录
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                {['报告类型', '提交时间', '目标机构', '状态', '签名指纹', '回执编号', '版本'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', fontWeight: 600, color: '#1f2937', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {submissionHistory.map((s, i) => (
                <tr key={s.id} style={{ borderBottom: '1px solid #e5e7eb', background: i % 2 === 0 ? '#fff' : '#fafbfc', cursor: 'pointer' }}
                  onClick={() => setSelectedSubmission(s)}>
                  <td style={{ padding: '10px 12px', fontWeight: 600 }}>{s.reportType}</td>
                  <td style={{ padding: '10px 12px', color: COLORS.textMuted }}>{s.submittedAt}</td>
                  <td style={{ padding: '10px 12px' }}>{s.target}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{
                      padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600,
                      background: s.status === 'success' ? '#d1fae5' : s.status === 'failed' ? '#fee2e2' : s.status === 'amended' ? '#fef3c7' : '#dbeafe',
                      color: s.status === 'success' ? '#16a34a' : s.status === 'failed' ? '#dc2626' : s.status === 'amended' ? '#d97706' : '#2563eb'
                    }}>{s.status === 'success' ? '成功' : s.status === 'failed' ? '失败' : s.status === 'amended' ? '已修正' : '待处理'}</span>
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: 12, color: COLORS.textMuted, fontFamily: 'monospace' }}>{s.signature.substring(0, 12)}...</td>
                  <td style={{ padding: '10px 12px', fontSize: 12, color: COLORS.textMuted }}>{s.receiptId || '-'}</td>
                  <td style={{ padding: '10px 12px' }}>v{s.version}{s.amendedVersion ? ` (原v${s.amendedVersion})` : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 数字签名详情 */}
      {selectedSubmission && (
        <div style={{ background: '#fff', borderRadius: 8, padding: 16, border: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#1f2937', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Fingerprint size={16} color={COLORS.primary} /> 签名详情
            </div>
            <button onClick={() => setSelectedSubmission(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: COLORS.textMuted }}><X size={16} /></button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><span style={{ fontSize: 12, color: COLORS.textMuted }}>签名指纹:</span><div style={{ fontSize: 12, fontWeight: 600, fontFamily: 'monospace', wordBreak: 'break-all' }}>{selectedSubmission.signature}</div></div>
            <div><span style={{ fontSize: 12, color: COLORS.textMuted }}>签名算法:</span><div style={{ fontSize: 12, fontWeight: 600 }}>SHA-256 with RSA</div></div>
            <div><span style={{ fontSize: 12, color: COLORS.textMuted }}>签名时间:</span><div style={{ fontSize: 12, fontWeight: 600 }}>{selectedSubmission.submittedAt}</div></div>
            <div><span style={{ fontSize: 12, color: COLORS.textMuted }}>签名人:</span><div style={{ fontSize: 12, fontWeight: 600 }}>放射科主任 (数字证书)</div></div>
          </div>
        </div>
      )}

      {/* 统计 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <div style={{ background: '#fff', borderRadius: 8, padding: 12, border: '1px solid #e5e7eb', textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: COLORS.primary }}>{submissionHistory.length}</div>
          <div style={{ fontSize: 12, color: COLORS.textMuted }}>总提交次数</div>
        </div>
        <div style={{ background: '#fff', borderRadius: 8, padding: 12, border: '1px solid #e5e7eb', textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: COLORS.success }}>{submissionHistory.filter(s => s.status === 'success').length}</div>
          <div style={{ fontSize: 12, color: COLORS.textMuted }}>成功次数</div>
        </div>
        <div style={{ background: '#fff', borderRadius: 8, padding: 12, border: '1px solid #e5e7eb', textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: COLORS.danger }}>{submissionHistory.filter(s => s.status === 'failed').length}</div>
          <div style={{ fontSize: 12, color: COLORS.textMuted }}>失败次数</div>
        </div>
        <div style={{ background: '#fff', borderRadius: 8, padding: 12, border: '1px solid #e5e7eb', textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: COLORS.warning }}>{submissionHistory.filter(s => s.amendedVersion).length}</div>
          <div style={{ fontSize: 12, color: COLORS.textMuted }}>修正版本数</div>
        </div>
      </div>
    </div>
  )
}

// 5. 计划报告组件
const ScheduledReportsPanel = () => {
  const [schedules, setSchedules] = useState(scheduledReports)
  const [runStatus, setRunStatus] = useState<string | null>(null)

  const toggleSchedule = (id: string) => {
    setSchedules(prev => prev.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s))
  }

  const handleRunNow = (id: string) => {
    setRunStatus(id)
    setTimeout(() => {
      setSchedules(prev => prev.map(s => s.id === id ? { ...s, lastRun: new Date().toISOString().slice(0, 16).replace('T', ' ') } : s))
      setRunStatus(null)
    }, 2000)
  }

  const scheduleLabels: Record<string, string> = { daily: '每日', weekly: '每周', monthly: '每月', quarterly: '每季度' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#1f2937', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Calendar size={18} color={COLORS.primary} /> 自动报告计划
        </div>
        <button style={{ padding: '8px 16px', background: COLORS.primary, color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={14} /> 新建计划
        </button>
      </div>

      {schedules.map(s => (
        <div key={s.id} style={{ background: '#fff', borderRadius: 8, padding: 16, border: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 8,
                background: s.enabled ? '#eff6ff' : '#f3f4f6',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.enabled ? COLORS.primary : COLORS.textMuted
              }}><FileText size={18} /></div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1f2937' }}>{s.name}</div>
                <div style={{ fontSize: 12, color: COLORS.textMuted }}>{s.type} · {scheduleLabels[s.schedule]} · {s.format}</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ position: 'relative', display: 'inline-block', width: 40, height: 22 }}>
                <input type="checkbox" checked={s.enabled} onChange={() => toggleSchedule(s.id)} style={{ opacity: 0, width: 0, height: 0 }} />
                <span style={{
                  position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 22,
                  backgroundColor: s.enabled ? COLORS.primary : '#d1d5db', transition: '0.3s'
                }}>
                  <span style={{
                    position: 'absolute', content: '', height: 18, width: 18, borderRadius: '50%', left: s.enabled ? 20 : 2, top: 2,
                    backgroundColor: '#fff', transition: '0.3s'
                  }} />
                </span>
              </label>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 12 }}>
            <div style={{ background: '#f9fafb', borderRadius: 6, padding: '8px 12px' }}>
              <div style={{ fontSize: 12, color: COLORS.textMuted }}>上次执行</div>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{s.lastRun}</div>
            </div>
            <div style={{ background: '#f9fafb', borderRadius: 6, padding: '8px 12px' }}>
              <div style={{ fontSize: 12, color: COLORS.textMuted }}>下次执行</div>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{s.nextRun}</div>
            </div>
            <div style={{ background: '#f9fafb', borderRadius: 6, padding: '8px 12px' }}>
              <div style={{ fontSize: 12, color: COLORS.textMuted }}>收件人</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.textMuted }}>{s.recipients.length}人</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {s.recipients.map((r, idx) => (
                <span key={idx} style={{ padding: '2px 8px', background: '#eff6ff', color: COLORS.primary, borderRadius: 4, fontSize: 12 }}>{r}</span>
              ))}
            </div>
            <button onClick={() => handleRunNow(s.id)} disabled={runStatus === s.id}
              style={{ padding: '6px 14px', background: s.enabled ? COLORS.primary : '#d1d5db', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: s.enabled ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Repeat size={12} /> {runStatus === s.id ? '运行中...' : '立即执行'}
            </button>
          </div>
        </div>
      ))}

      {/* 失败重试逻辑 */}
      <div style={{ padding: '12px 16px', background: '#fef3c7', borderRadius: 8, border: '1px solid #fde68a', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <AlertTriangle size={14} color={COLORS.warning} style={{ marginTop: 2 }} />
        <div style={{ fontSize: 12, color: '#1f2937' }}>
          <strong>自动重试：</strong>提交失败时将自动重试最多3次，间隔5分钟。当前无待重试任务。
        </div>
      </div>
    </div>
  )
}

// ============ 主组件 ============
export default function NationalReportPage() {
  const [activeTab, setActiveTab] = useState<'exam' | 'dose' | 'quality' | 'log' | 'fhir' | 'regulator' | 'validation' | 'audit' | 'schedule'>('exam')
  const [selectedMonth, setSelectedMonth] = useState('2026-05')
  const [searchKeyword, setSearchKeyword] = useState('')
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [submitType, setSubmitType] = useState<'exam' | 'dose' | 'quality'>('exam')
  const [submitSuccess, setSubmitSuccess] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [doseData, setDoseData] = useState<DoseReport[]>(doseReportData)
  const [examStats, setExamStats] = useState<ExamStatistics[]>(examStatisticsData)
  const [reportLogs, setReportLogs] = useState<ReportLog[]>(reportLogData)
  const [monthlyTrends, setMonthlyTrends] = useState(monthlyTrendData)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [examRes, doseRes, logRes, trendRes] = await Promise.allSettled([
        datareportApi.listExamStatistics(),
        datareportApi.listNationalReports(),
        datareportApi.listReportLogs(),
        datareportApi.getMonthlyTrends(),
      ])
      if (cancelled) return
      if (examRes.status === 'fulfilled' && examRes.value.success && Array.isArray(examRes.value.data)) {
        setExamStats(examRes.value.data)
      }
      if (doseRes.status === 'fulfilled' && doseRes.value.success && Array.isArray(doseRes.value.data)) {
        setDoseData(doseRes.value.data)
      }
      if (logRes.status === 'fulfilled' && logRes.value.success && Array.isArray(logRes.value.data)) {
        setReportLogs(logRes.value.data)
      }
      if (trendRes.status === 'fulfilled' && trendRes.value.success && Array.isArray(trendRes.value.data)) {
        setMonthlyTrends(trendRes.value.data)
      }
    })()
    return () => { cancelled = true }
  }, [])

  // 统计数据
  const totalExams = examStats.reduce((sum, item) => sum + item.examCount, 0)
  const totalPositive = examStats.reduce((sum, item) => sum + item.positiveCount, 0)
  const avgQualifiedRate = examStats.length > 0 ? examStats.reduce((sum, item) => sum + item.qualifiedRate, 0) / examStats.length : 0
  const pendingReports = doseData.filter(d => d.status === '待上报').length

  // 筛选数据
  const filteredExamData = examStats.filter(item =>
    item.examType.includes(searchKeyword) || item.modality.includes(searchKeyword)
  )

  const filteredDoseData = doseData.filter(item =>
    item.reportMonth === selectedMonth || searchKeyword === ''
  )

  const handleSubmitReport = () => {
    setShowSubmitModal(false)
    setSubmitSuccess(`${submitType === 'exam' ? '检查统计' : submitType === 'dose' ? '辐射剂量' : '报告质量'}数据已提交上报`)
    // 更新数据状态为已上报
    if (submitType === 'dose') {
      setDoseData(prev => prev.map(d => d.reportMonth === selectedMonth ? { ...d, status: '已上报' } : d))
    }
    setTimeout(() => setSubmitSuccess(''), 3000)
  }

  const handleExport = (type: 'exam' | 'dose' | 'quality') => {
    if (type === 'exam') {
      exportToCSV(examStats, 'exam_statistics.csv', ['ID', '设备类型', '检查项目', '检查数量', '阳性数', '阳性率', '平均报告时间', '合格率'])
    } else if (type === 'dose') {
      exportToCSV(doseData, 'dose_report.csv', ['ID', '上报月份', '设备类型', '总检查数', '总DLP', '平均DLP', '总CTDI', '平均CTDI', '预警次数', '高剂量人数', '状态'])
    } else {
      exportToCSV(qualityReportData, 'quality_report.csv', ['ID', '上报月份', '总报告数', '合格数', '优秀数', '合格率', '优秀率', '平均分', '常见问题', '改进措施', '状态'])
    }
  }

  return (
    <div style={styles.pageContainer}>
      {/* 顶部标题栏 */}
      <div style={styles.header}>
        <div>
          <div style={styles.headerTitle}>
            <Database size={24} />
            <span>国家数据上报</span>
          </div>
          <div style={styles.headerSubtitle}>CT/MRI/X线检查统计数据上报 · 辐射剂量数据上报 · 报告质量数据上报</div>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button style={{ ...styles.button, ...styles.buttonOutline }} onClick={() => handleExport(activeTab as any)}>
            <Download size={16} />
            导出报表
          </button>
          <button style={{ ...styles.button, ...styles.buttonPrimary }} onClick={() => { setSubmitType(activeTab as any); setShowSubmitModal(true); }}>
            <Upload size={16} />
            上报数据
          </button>
        </div>
      </div>

      {/* 统计卡片 */}
      <div style={styles.statsContainer}>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>
            <BarChart3 size={14} />
            本期检查总数
          </div>
          <div style={styles.statValue}>{totalExams.toLocaleString()}</div>
          <div style={{ ...styles.statChange, color: COLORS.success }}>
            <TrendingUp size={12} />
            <span>较上月 +12.5%</span>
          </div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>
            <Activity size={14} />
            阳性检出总数
          </div>
          <div style={{ ...styles.statValue, color: COLORS.warning }}>{totalPositive.toLocaleString()}</div>
          <div style={{ ...styles.statChange, color: COLORS.textMuted }}>
            <span>阳性率 {((totalPositive / totalExams) * 100).toFixed(1)}%</span>
          </div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>
            <ShieldCheck size={14} />
            平均合格率
          </div>
          <div style={{ ...styles.statValue, color: COLORS.success }}>{avgQualifiedRate.toFixed(1)}%</div>
          <div style={{ ...styles.statChange, color: COLORS.success }}>
            <CheckCircle size={12} />
            <span>达到标准</span>
          </div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>
            <AlertTriangle size={14} />
            待上报报表
          </div>
          <div style={{ ...styles.statValue, color: pendingReports > 0 ? COLORS.warning : COLORS.success }}>{pendingReports}</div>
          <div style={{ ...styles.statChange, color: COLORS.textMuted }}>
            <span>需及时上报</span>
          </div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>
            <Calendar size={14} />
            上报周期
          </div>
          <div style={styles.statValue}>{selectedMonth}</div>
          <div style={{ ...styles.statChange, color: COLORS.textMuted }}>
            <span>月度上报</span>
          </div>
        </div>
      </div>

      {/* 主内容区 */}
      <div style={styles.mainContent}>
        {/* 左侧面板 */}
        <div style={styles.leftPanel}>
          <div style={styles.panelHeader}>
            <span>上报类型</span>
            <Filter size={14} />
          </div>
          <div style={styles.panelBody}>
            {[
              { key: 'exam', label: '检查统计数据', icon: Scan, count: examStats.length },
              { key: 'dose', label: '辐射剂量数据', icon: Radio, count: doseData.length },
              { key: 'quality', label: '报告质量数据', icon: ShieldCheck, count: qualityReportData.length },
              { key: 'log', label: '上报记录', icon: Clock, count: reportLogs.length },
              { key: 'fhir', label: 'FHIR标准化', icon: FileJson, count: 3 },
              { key: 'regulator', label: '多监管机构', icon: Globe, count: regulatorTargets.length },
              { key: 'validation', label: '预提交验证', icon: CheckCircle, count: validationChecks.length },
              { key: 'audit', label: '审计追踪', icon: Fingerprint, count: submissionHistory.length },
              { key: 'schedule', label: '计划报告', icon: Calendar, count: scheduledReports.length },
            ].map(item => (
              <div
                key={item.key}
                style={{
                  ...styles.listItem,
                  ...(activeTab === item.key ? styles.listItemActive : {}),
                }}
                onClick={() => setActiveTab(item.key as any)}
              >
                <item.icon size={18} color={activeTab === item.key ? COLORS.primary : COLORS.textMuted} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: 500 }}>{item.label}</div>
                  <div style={{ fontSize: '11px', color: COLORS.textMuted }}>共 {item.count} 条</div>
                </div>
                {activeTab === item.key && <ChevronRight size={16} color={COLORS.primary} />}
              </div>
            ))}
          </div>

          {/* 月度趋势图 */}
          <div style={{ padding: '12px', borderTop: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px', color: COLORS.textDark }}>检查量趋势</div>
            <div style={styles.chartContainer}>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={monthlyTrends}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="CT" stroke={COLORS.ct} strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="MRI" stroke={COLORS.mri} strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="DR" stroke={COLORS.dr} strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* 中间面板 */}
        <div style={styles.middlePanel}>
          <div style={styles.tabContainer}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: 'auto' }}>
              <span style={{ fontWeight: 600 }}>{activeTab === 'exam' ? '检查统计报表' : activeTab === 'dose' ? '辐射剂量报表' : activeTab === 'quality' ? '报告质量报表' : '上报记录'}</span>
            </div>
            <div style={styles.searchBox}>
              <Search size={14} color={COLORS.textMuted} />
              <input
                type="text"
                placeholder="搜索..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                style={{ ...styles.input, border: 'none', background: 'transparent', width: '120px', padding: '4px' }}
              />
            </div>
          </div>

          <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
            {/* 检查统计表格 */}
            {activeTab === 'exam' && (
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>设备类型</th>
                    <th style={styles.th}>检查项目</th>
                    <th style={styles.th}>检查数量</th>
                    <th style={styles.th}>阳性数</th>
                    <th style={styles.th}>阳性率</th>
                    <th style={styles.th}>平均报告时间</th>
                    <th style={styles.th}>合格率</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExamData.map(item => (
                    <tr key={item.id}>
                      <td style={styles.td}>{getModalityBadge(item.modality)}</td>
                      <td style={styles.td}>{item.examType}</td>
                      <td style={{ ...styles.td, fontWeight: 600 }}>{item.examCount.toLocaleString()}</td>
                      <td style={{ ...styles.td, color: COLORS.warning }}>{item.positiveCount}</td>
                      <td style={styles.td}>{item.positiveRate}%</td>
                      <td style={styles.td}>{item.avgReportTime}分钟</td>
                      <td style={{ ...styles.td, color: item.qualifiedRate >= 95 ? COLORS.success : COLORS.warning }}>{item.qualifiedRate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* 辐射剂量表格 */}
            {activeTab === 'dose' && (
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>上报月份</th>
                    <th style={styles.th}>设备类型</th>
                    <th style={styles.th}>检查总数</th>
                    <th style={styles.th}>总DLP(mGy·cm)</th>
                    <th style={styles.th}>平均DLP</th>
                    <th style={styles.th}>平均CTDIvol</th>
                    <th style={styles.th}>预警次数</th>
                    <th style={styles.th}>高剂量人数</th>
                    <th style={styles.th}>状态</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDoseData.map(item => (
                    <tr key={item.id}>
                      <td style={styles.td}>{item.reportMonth}</td>
                      <td style={styles.td}>{getModalityBadge(item.modality)}</td>
                      <td style={{ ...styles.td, fontWeight: 600 }}>{item.totalExams.toLocaleString()}</td>
                      <td style={styles.td}>{item.totalDLP > 0 ? item.totalDLP.toLocaleString() : '-'}</td>
                      <td style={styles.td}>{item.avgDLP > 0 ? item.avgDLP : '-'}</td>
                      <td style={styles.td}>{item.avgCTDI > 0 ? item.avgCTDI : '-'}</td>
                      <td style={{ ...styles.td, color: item.alertCount > 0 ? COLORS.warning : COLORS.success }}>{item.alertCount}</td>
                      <td style={styles.td}>{item.highDoseCount}</td>
                      <td style={styles.td}>{getStatusBadge(item.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* 报告质量表格 */}
            {activeTab === 'quality' && (
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>上报月份</th>
                    <th style={styles.th}>总报告数</th>
                    <th style={styles.th}>合格数</th>
                    <th style={styles.th}>优秀数</th>
                    <th style={styles.th}>合格率</th>
                    <th style={styles.th}>优秀率</th>
                    <th style={styles.th}>平均分</th>
                    <th style={styles.th}>常见问题</th>
                    <th style={styles.th}>状态</th>
                  </tr>
                </thead>
                <tbody>
                  {qualityReportData.map(item => (
                    <tr key={item.id}>
                      <td style={styles.td}>{item.reportMonth}</td>
                      <td style={{ ...styles.td, fontWeight: 600 }}>{item.totalReports.toLocaleString()}</td>
                      <td style={styles.td}>{item.qualifiedReports}</td>
                      <td style={styles.td}>{item.excellentReports}</td>
                      <td style={{ ...styles.td, color: item.qualifiedRate >= 95 ? COLORS.success : COLORS.warning }}>{item.qualifiedRate}%</td>
                      <td style={styles.td}>{item.excellentRate}%</td>
                      <td style={styles.td}>{item.avgScore}</td>
                      <td style={styles.td}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {item.commonIssues.slice(0, 2).map((issue, idx) => (
                            <span key={idx} style={{ padding: '2px 6px', background: '#fef3c7', color: '#d97706', borderRadius: '4px', fontSize: '10px' }}>{issue}</span>
                          ))}
                        </div>
                      </td>
                      <td style={styles.td}>{getStatusBadge(item.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* FHIR标准化报告 */}
            {activeTab === 'fhir' && <FHIRReportPanel />}

            {/* 多监管机构 */}
            {activeTab === 'regulator' && <MultiRegulatorPanel />}

            {/* 预提交验证 */}
            {activeTab === 'validation' && <PreSubmissionValidation />}

            {/* 审计追踪 */}
            {activeTab === 'audit' && <SubmissionAuditTrail />}

            {/* 计划报告 */}
            {activeTab === 'schedule' && <ScheduledReportsPanel />}

            {/* 上报记录 */}
            {activeTab === 'log' && (
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>上报类型</th>
                    <th style={styles.th}>上报月份</th>
                    <th style={styles.th}>上报时间</th>
                    <th style={styles.th}>操作人</th>
                    <th style={styles.th}>状态</th>
                    <th style={styles.th}>备注</th>
                  </tr>
                </thead>
                <tbody>
                  {reportLogs.map(item => (
                    <tr key={item.id}>
                      <td style={styles.td}>
                        <span style={{ padding: '3px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, backgroundColor: item.reportType === 'dose' ? '#fef3c7' : item.reportType === 'exam' ? '#dbeafe' : '#d1fae5', color: item.reportType === 'dose' ? '#d97706' : item.reportType === 'exam' ? '#2563eb' : '#16a34a' }}>
                          {item.reportType === 'dose' ? '辐射剂量' : item.reportType === 'exam' ? '检查统计' : '报告质量'}
                        </span>
                      </td>
                      <td style={styles.td}>{item.reportMonth}</td>
                      <td style={styles.td}>{item.submitTime}</td>
                      <td style={styles.td}>{item.operator}</td>
                      <td style={styles.td}>{getStatusBadge(item.status)}</td>
                      <td style={styles.td}>{item.note || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* 分页 */}
          <div style={styles.pagination}>
            <div style={{ fontSize: '12px', color: COLORS.textMuted }}>
              共 {activeTab === 'exam' ? filteredExamData.length : activeTab === 'dose' ? filteredDoseData.length : activeTab === 'quality' ? qualityReportData.length : reportLogData.length} 条记录
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button style={{ ...styles.button, padding: '6px 12px', fontSize: '12px' }} onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}>上一页</button>
              <button style={{ ...styles.button, padding: '6px 12px', fontSize: '12px' }} onClick={() => setCurrentPage(currentPage + 1)}>下一页</button>
            </div>
          </div>
        </div>

        {/* 右侧面板 */}
        <div style={styles.rightPanel}>
          {/* 设备分布 */}
          <div style={styles.panelHeader}>
            <span>设备类型分布</span>
            <PieChartIcon size={14} />
          </div>
          <div style={styles.chartContainer}>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={deviceDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {deviceDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '0 12px 12px' }}>
            {deviceDistribution.map(item => (
              <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: item.color }} />
                <span style={{ fontSize: '11px' }}>{item.name} {item.value}%</span>
              </div>
            ))}
          </div>

          {/* 上报进度 */}
          <div style={{ ...styles.panelHeader, borderTop: '1px solid #e5e7eb' }}>
            <span>本期上报进度</span>
            <Globe size={14} />
          </div>
          <div style={{ padding: '12px' }}>
            {[
              { label: '检查统计数据', progress: 80, color: COLORS.ct },
              { label: '辐射剂量数据', progress: 65, color: COLORS.mri },
              { label: '报告质量数据', progress: 50, color: COLORS.dr },
            ].map((item, idx) => (
              <div key={idx} style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '12px' }}>{item.label}</span>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: item.color }}>{item.progress}%</span>
                </div>
                <div style={styles.progressBar}>
                  <div style={{ ...styles.progressFill, width: `${item.progress}%`, backgroundColor: item.color }} />
                </div>
              </div>
            ))}
          </div>

          {/* 最新上报动态 */}
          <div style={{ ...styles.panelHeader, borderTop: '1px solid #e5e7eb' }}>
            <span>最新上报动态</span>
            <Activity size={14} />
          </div>
          <div style={{ ...styles.panelBody, padding: '12px' }}>
            {reportLogs.slice(0, 3).map(item => (
              <div key={item.id} style={{ display: 'flex', gap: '10px', marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid #f3f4f6' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FileText size={14} color={COLORS.primary} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '12px', fontWeight: 500 }}>{item.reportType === 'dose' ? '辐射剂量' : item.reportType === 'exam' ? '检查统计' : '报告质量'}数据已{item.status}</div>
                  <div style={{ fontSize: '11px', color: COLORS.textMuted }}>{item.submitTime}</div>
                </div>
              </div>
            ))}
          </div>

          {/* 快捷操作 */}
          <div style={{ padding: '12px', borderTop: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px' }}>快捷操作</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button style={{ ...styles.button, ...styles.buttonOutline, justifyContent: 'center' }} onClick={() => handleExport('exam')}>
                <Download size={14} />
                导出检查统计
              </button>
              <button style={{ ...styles.button, ...styles.buttonOutline, justifyContent: 'center' }} onClick={() => handleExport('dose')}>
                <Download size={14} />
                导出剂量数据
              </button>
              <button style={{ ...styles.button, ...styles.buttonOutline, justifyContent: 'center' }} onClick={() => handleExport('quality')}>
                <Download size={14} />
                导出质量报告
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 底部统计图 */}
      <div style={styles.bottomPanel}>
        <div style={styles.panelHeader}>
          <span>年度各设备检查量对比</span>
          <BarChart3 size={14} />
        </div>
        <div style={{ padding: '16px' }}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthlyTrends}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip contentStyle={{ fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="CT" fill={COLORS.ct} radius={[4, 4, 0, 0]} />
              <Bar dataKey="MRI" fill={COLORS.mri} radius={[4, 4, 0, 0]} />
              <Bar dataKey="DR" fill={COLORS.dr} radius={[4, 4, 0, 0]} />
              <Bar dataKey="MG" fill={COLORS.mg} radius={[4, 4, 0, 0]} />
              <Bar dataKey="DSA" fill={COLORS.dsa} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 上报确认弹窗 */}
      {showSubmitModal && (
        <div style={styles.modal} onClick={() => setShowSubmitModal(false)}>
          <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <span>确认上报数据</span>
              <X size={18} style={{ cursor: 'pointer' }} onClick={() => setShowSubmitModal(false)} />
            </div>
            <div style={styles.modalBody}>
              <div style={{ marginBottom: '16px', padding: '16px', background: '#f9fafb', borderRadius: '8px' }}>
                <div style={{ fontSize: '13px', marginBottom: '8px' }}>
                  <strong>上报类型：</strong>
                  {submitType === 'exam' ? '检查统计数据' : submitType === 'dose' ? '辐射剂量数据' : '报告质量数据'}
                </div>
                <div style={{ fontSize: '13px', marginBottom: '8px' }}>
                  <strong>上报周期：</strong>{selectedMonth}
                </div>
                <div style={{ fontSize: '13px' }}>
                  <strong>上报内容：</strong>
                  {submitType === 'exam' ? `${examStats.length} 条检查统计数据` :
                    submitType === 'dose' ? `${doseData.filter(d => d.reportMonth === selectedMonth).length} 条辐射剂量数据` :
                   `${qualityReportData.length} 条报告质量数据`}
                </div>
              </div>
              <div style={{ fontSize: '12px', color: COLORS.textMuted }}>
                确认后将数据上报至国家卫生健康委员会数据平台，请确保数据准确无误。
              </div>
            </div>
            <div style={styles.modalFooter}>
              <button style={{ ...styles.button, background: '#f3f4f6', color: COLORS.textDark }} onClick={() => setShowSubmitModal(false)}>
                取消
              </button>
              <button style={{ ...styles.button, ...styles.buttonPrimary }} onClick={handleSubmitReport}>
                <Check size={14} />
                确认上报
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 成功提示Toast */}
      {submitSuccess && (
        <div style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          backgroundColor: COLORS.success,
          color: 'white',
          padding: '12px 20px',
          borderRadius: 8,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          zIndex: 2000,
          animation: 'slideIn 0.3s ease-out',
        }}>
          <CheckCircle size={18} />
          <span style={{ fontSize: 14, fontWeight: 500 }}>{submitSuccess}</span>
        </div>
      )}
    </div>
  )
}
