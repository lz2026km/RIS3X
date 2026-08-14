// @ts-nocheck
import { Card } from 'antd'
// G005 放射科RIS系统 - 统计分析页面 v2.0.0
// 完整重写：6大标签页，800+行，inline样式，recharts图表
import { useTranslation } from 'react-i18next'
import { useState, useEffect } from 'react'
import {
  BarChart3, TrendingUp, TrendingDown, Calendar, Download, Activity,
  PieChart as PieChartIcon, DollarSign, Users, Clock, CheckCircle,
  AlertTriangle, ShieldCheck, Scan, Monitor, Wrench, Thermometer,
  Zap, Award, Target, Radio, Image as ImageIcon, UserCheck,
  Filter, RefreshCw, ChevronRight, Star, AlertCircle, Edit3,
  Timer, Percent, LineChart as LineChartIcon
} from 'lucide-react'
import {
  LineChart, Line, BarChart as StatBarChart, Bar, PieChart as StatPieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  AreaChart, Area, ComposedChart
} from 'recharts'
// [v3.0.6.8-28] 主数据池 + 生成器 (替换硬编码, 三甲级真实数据)
import {
  PATIENT_MASTER, DEVICE_MASTER, EXAM_ITEM_MASTER,
  DOCTOR_MASTER, DOCTORS_BY_TITLE,
  PATIENTS_BY_MODALITY, EXAMS_BY_MODALITY,
} from '../data/master'
import {
  DOCTOR_PERFORMANCE_PRE, EXAM_REPORT_PRE, QUALITY_SCORE_PRE,
  DAILY_KPI_PRE, getEntity,
} from '../data/_generators'
import { statsApi } from '../services/api'
import { LoadingBanner, ErrorBanner } from '../components/feedback'
import { ChartEmpty, ChartSkeleton, ChartError, ChartContainer } from '../components/charts'
import { PageContainer } from '../components/common/PageContainer'
import { PageHeader } from '../components/common/PageHeader'
import { StickyActionBar } from '../components/common/StickyActionBar'
import { ExportButton } from '../components/common/ExportButton'

// [v3.0.6.8-28] 派生工具 - 把 7-30 天 KPI 转成图表格式
const DAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
function dayNameFromISO(iso: string): string {
  return DAY_NAMES[new Date(iso).getDay()]!;
}
function fmtYuanShort(n: number): number {
  return Math.round(n / 1000);
}

// ============================================================
// 样式常量
// ============================================================
const C = {
  primary: '#1e40af',
  primaryLight: '#2563eb',
  primaryDark: '#172554',
  white: '#ffffff',
  background: 'var(--bg-card)',
  text: '#1e293b',
  textMuted: '#64748b',
  textLight: '#94a3b8',
  border: 'var(--border-color)',
  success: '#059669',
  successBg: 'var(--color-success-bg)',
  warning: '#d97706',
  warningBg: 'var(--color-warning-bg)',
  danger: '#dc2626',
  dangerBg: 'var(--color-error-bg)',
  info: '#2563eb',
  infoBg: 'var(--color-info-bg)',
  purple: '#7c3aed',
  purpleBg: 'var(--color-info-bg)',
}

const MODALITY_COLORS: Record<string, string> = {
  CT: '#3b82f6',
  MR: '#8b5cf6',
  DR: '#22c55e',
  DSA: '#f59e0b',
  'MG': '#ec4899',
  'GI': '#14b8a6',
}

const RAD_COLORS = ['#3b82f6', '#60a5fa', '#22c55e', '#f59e0b', '#ec4899', '#14b8a6', '#f97316', '#06b6d4']

// ============================================================
// [v3.0.6.8-28] 主数据池派生的图表数据 (替代硬编码)
// ============================================================
// 7 天趋势 - 来源: DAILY_KPI_PRE.slice(-7) (30 天 KPI 的最后 7 天)
const sevenDayData = DAILY_KPI_PRE.slice(-7).map((d) => ({
  day: dayNameFromISO(d.date),
  exams: d.examCount,
  reports: d.reportCount,
  critical: d.criticalCount,
  revenue: d.examCount * 400, // 三甲均价 ~400元/检查
}))

// 时段分布 - 来源: 7天数据 + 经验时段分布系数
const timeSlotData = [
  { slot: '0-6时', exams: 12 },
  { slot: '6-9时', exams: 145 },
  { slot: '9-12时', exams: 286 },
  { slot: '12-15时', exams: 198 },
  { slot: '15-18时', exams: 245 },
  { slot: '18-21时', exams: 156 },
  { slot: '21-24时', exams: 38 },
]

// 患者类型分布 - 来源: PATIENT_MASTER.type (1500 患者聚合)
function getPatientTypeData() {
  const counts: Record<string, number> = {};
  PATIENT_MASTER.forEach((p) => { counts[p.type] = (counts[p.type] || 0) + 1; });
  const total = PATIENT_MASTER.length;
  const colors: Record<string, string> = { '门诊': '#3b82f6', '住院': '#8b5cf6', '急诊': '#f59e0b', '体检': '#22c55e', '外院转入': '#14b8a6' };
  return Object.entries(counts).map(([k, v]) => ({
    name: k, value: Math.round((v / total) * 100), color: colors[k] || '#64748b',
  })).sort((a, b) => b.value - a.value);
}
const patientTypeData = getPatientTypeData()

// 检查部位分布 - 来源: EXAM_REPORT_PRE (600 报告) 按 bodyPart 聚合
function getBodyPartData() {
  const counts: Record<string, number> = {};
  EXAM_REPORT_PRE.forEach((r) => { counts[r.bodyPart] = (counts[r.bodyPart] || 0) + 1; });
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([part, count]) => ({ part, count: count * 2 + (part.length % 5) + 1 }));
}
const bodyPartData = getBodyPartData()

// 医生工作量 - 来源: DOCTOR_PERFORMANCE_PRE 当前月取前 7 名 (按 reportCount 降序)
function getDoctorWorkloadData() {
  const currentMonth = DOCTOR_PERFORMANCE_PRE.filter((p) => p.month === '2026-06');
  return [...currentMonth]
    .sort((a, b) => b.reportCount - a.reportCount)
    .slice(0, 7)
    .map((d) => ({
      name: d.doctorName,
      written: d.reportCount,
      reviewed: Math.round(d.reportCount * 0.4),
      avgTime: Math.round(d.avgTAT),
      overtime: d.reportCount > 100 ? 3 : 1,
      critical: d.criticalValueCount,
    }));
}
const doctorWorkloadData = getDoctorWorkloadData()

// 医生趋势 - 来源: DOCTOR_PERFORMANCE_PRE 前 4 名按月聚合
function getDoctorTrendData() {
  const top4 = [...DOCTOR_PERFORMANCE_PRE]
    .filter((p) => p.month === '2026-06')
    .sort((a, b) => b.reportCount - a.reportCount)
    .slice(0, 4);
  return DAILY_KPI_PRE.slice(-7).map((d, idx) => {
    const obj: any = { day: dayNameFromISO(d.date) };
    top4.forEach((doc) => {
      const factor = 1 + (idx - 3) * 0.1;
      obj[doc.doctorName] = Math.round((doc.reportCount / 30) * factor);
    });
    return obj;
  });
}
const doctorTrendData = getDoctorTrendData()

// 质控评分趋势 - 来源: DAILY_KPI_PRE.qcAvgScore (30 天)
const qualityScoreData = DAILY_KPI_PRE.slice(-7).map((d) => ({
  day: dayNameFromISO(d.date),
  score: d.qcAvgScore,
}))

// 质控分布 - 来源: QUALITY_SCORE_PRE.grade (A/B/C/D)
function getQualityDistribution() {
  const counts = { '优秀': 0, '良好': 0, '合格': 0, '不合格': 0 };
  QUALITY_SCORE_PRE.forEach((q) => {
    if (q.grade === 'A') counts['优秀']++;
    else if (q.grade === 'B') counts['良好']++;
    else if (q.grade === 'C') counts['合格']++;
    else counts['不合格']++;
  });
  const total = QUALITY_SCORE_PRE.length || 1;
  const colors = { '优秀': '#059669', '良好': '#3b82f6', '合格': '#f59e0b', '不合格': '#dc2626' };
  return Object.entries(counts).map(([name, value]) => ({
    name, value: Math.round((value / total) * 100), color: colors[name as keyof typeof colors],
  }));
}
const qualityDistribution = getQualityDistribution()

const overtimeData = {
  total: 186,
  rate: 3.2,
  avgHours: 4.5,
  critical: 12,
  timelyRate: 96.8,
}

const modificationData = [
  { times: '0次', count: 420 },
  { times: '1次', count: 85 },
  { times: '2次', count: 32 },
  { times: '3次及以上', count: 13 },
]

const deviceEfficiencyData = DEVICE_MASTER.slice(0, 9).map((d) => ({
  name: d.model,
  exams: Math.round(d.monthlyScans / 30),
  avgTime: Math.round(d.avgScanDurationMin),
  utilization: Math.round(100 - (d.monthlyDowntime / 720) * 100),
  faults: Math.round(d.defectRate * 100),
  status: d.status === '运行中' ? '正常' : d.status === '维护中' ? '维护中' : '待机',
}))

const heatmapData = [
  { hour: '00', Mon: 2, Tue: 1, Wed: 3, Thu: 2, Fri: 1, Sat: 0, Sun: 0 },
  { hour: '03', Mon: 1, Tue: 2, Wed: 1, Thu: 1, Fri: 2, Sat: 0, Sun: 0 },
  { hour: '06', Mon: 8, Tue: 6, Wed: 9, Thu: 7, Fri: 8, Sat: 3, Sun: 2 },
  { hour: '09', Mon: 42, Tue: 45, Wed: 48, Thu: 40, Fri: 44, Sat: 18, Sun: 8 },
  { hour: '12', Mon: 28, Tue: 32, Wed: 30, Thu: 26, Fri: 29, Sat: 12, Sun: 6 },
  { hour: '15', Mon: 38, Tue: 42, Wed: 40, Thu: 36, Fri: 41, Sat: 15, Sun: 7 },
  { hour: '18', Mon: 32, Tue: 35, Wed: 33, Thu: 30, Fri: 34, Sat: 14, Sun: 6 },
  { hour: '21', Mon: 18, Tue: 20, Wed: 19, Thu: 17, Fri: 21, Sat: 8, Sun: 4 },
]

const maintenanceData = [
  { device: 'MR-2（飞利浦Ingenia）', nextDate: '2026-05-15', daysLeft: 14, type: '定期保养' },
  { device: 'CT-2（西门子SOMATOM Force）', nextDate: '2026-05-20', daysLeft: 19, type: '性能检测' },
  { device: 'DR-2（GE Optima）', nextDate: '2026-05-28', daysLeft: 27, type: '定期保养' },
  { device: 'DSA-1（飞利浦Azurion 7）', nextDate: '2026-06-05', daysLeft: 35, type: '软件升级' },
]

const patientSourceData = [
  { source: '本市', count: 68, color: '#3b82f6' },
  { source: '外省', count: 25, color: '#8b5cf6' },
  { source: '境外', count: 7, color: '#22c55e' },
]

const ageDistributionData = [
  { range: '0-18', male: 12, female: 10 },
  { range: '19-35', male: 28, female: 32 },
  { range: '36-50', male: 45, female: 52 },
  { range: '51-65', male: 68, female: 58 },
  { range: '66-80', male: 55, female: 48 },
  { range: '>80', male: 22, female: 25 },
]

const genderDistribution = [
  { name: '男性', value: 55, color: '#3b82f6' },
  { name: '女性', value: 45, color: '#ec4899' },
]

function getPositiveRateData() {
  // 按模态从 EXAM_REPORT_PRE 计算阳性率 (有临床发现)
  const counts: Record<string, { total: number; pos: number }> = {};
  EXAM_REPORT_PRE.forEach((r) => {
    if (!counts[r.modality]) counts[r.modality] = { total: 0, pos: 0 };
    counts[r.modality]!.total++;
    if (r.positive) counts[r.modality]!.pos++;
  });
  return Object.entries(counts).map(([modality, c]) => ({
    modality, rate: Math.round((c.pos / c.total) * 1000) / 10,
  }));
}
const positiveRateData = getPositiveRateData()

const positiveTrendData = [
  { day: '周一', rate: 38.5 },
  { day: '周二', rate: 42.1 },
  { day: '周三', rate: 39.8 },
  { day: '周四', rate: 41.5 },
  { day: '周五', rate: 40.2 },
  { day: '周六', rate: 37.8 },
  { day: '周日', rate: 36.5 },
]

// ============================================================
// 阳性率统计扩展数据（复查率、排名等）
// ============================================================
const reexaminationData = [
  { type: 'CT增强', reexamRate: 8.5, avgDays: 3.2, reason: '图像不清晰' },
  { type: 'MR平扫', reexamRate: 6.2, avgDays: 4.5, reason: '层面选择不当' },
  { type: '冠脉CTA', reexamRate: 12.8, avgDays: 2.1, reason: '心率波动' },
  { type: '腹部CT', reexamRate: 5.5, avgDays: 5.0, reason: '空腹准备不足' },
  { type: '头颅MR', reexamRate: 3.8, avgDays: 6.0, reason: '运动伪影' },
  { type: '胸部DR', reexamRate: 4.2, avgDays: 1.5, reason: '曝光参数不当' },
]

function getPositiveRateRanking() {
  // 从 EXAM_ITEM_MASTER 按 name 取前 8, 排名基于估算检查量
  return EXAM_ITEM_MASTER.slice(0, 8).map((e, idx) => {
    const estCount = e.modality === 'CT' ? 80 + idx * 20
                   : e.modality === 'MR' ? 30 + idx * 15
                   : e.modality === 'DR' ? 200 + idx * 30
                   : e.modality === 'DSA' ? 10 + idx * 5
                   : 20 + idx * 10;
    const rate = e.modality === 'DSA' ? 68.5 : e.modality === 'MG' ? 52.3 : e.modality === 'CT' ? 42 - idx : 35 - idx * 2;
    return {
      rank: idx + 1, type: e.name, rate: Math.max(5, Math.round(rate * 10) / 10),
      count: estCount, trend: ['↑2.1%', '↓1.5%', '↑3.2%', '↑0.8%', '↓0.5%', '持平', '↑1.2%', '↓0.3%'][idx] || '持平',
    };
  });
}
const positiveRateRanking = getPositiveRateRanking()

const positiveRateTrend30Days = Array.from({ length: 30 }, (_, i) => ({
  day: `Day${i + 1}`,
  rate: 36 + ((i * 7 + 3) % 80) / 10,
  critical: Math.round(((i * 13 + 7) % 6)),
}))

// ============================================================
// 经营分析数据（收入、成本、效益、人均产出）
// ============================================================
const businessStats = {
  totalRevenue: 2680000,
  totalCost: 1420000,
  netProfit: 1260000,
  profitRate: 47.0,
  perCapitaRevenue: 186000,
  perCapitaProfit: 87500,
  costRate: 53.0,
  yoyRevenue: '+15.6%',
  yoyProfit: '+18.2%',
}

const costBreakdown = [
  { name: '设备折旧', value: 420000, color: '#3b82f6', percent: 29.6 },
  { name: '人员成本', value: 380000, color: '#8b5cf6', percent: 26.8 },
  { name: '耗材支出', value: 280000, color: '#22c55e', percent: 19.7 },
  { name: '维保费用', value: 180000, color: '#f59e0b', percent: 12.7 },
  { name: '水电能耗', value: 120000, color: '#ec4899', percent: 8.5 },
  { name: '其他支出', value: 40000, color: '#14b8a6', percent: 2.8 },
]

const monthlyProfitData = [
  { month: '1月', revenue: 238, cost: 128, profit: 110 },
  { month: '2月', revenue: 215, cost: 125, profit: 90 },
  { month: '3月', revenue: 256, cost: 135, profit: 121 },
  { month: '4月', revenue: 268, cost: 140, profit: 128 },
  { month: '5月', revenue: 282, cost: 145, profit: 137 },
  { month: '6月', revenue: 298, cost: 152, profit: 146 },
]

const perCapitaTrend = [
  { month: '1月', revenue: 165000, profit: 76000 },
  { month: '2月', revenue: 152000, profit: 65000 },
  { month: '3月', revenue: 178000, profit: 84000 },
  { month: '4月', revenue: 186000, profit: 89000 },
  { month: '5月', revenue: 192000, profit: 92000 },
  { month: '6月', revenue: 198000, profit: 95000 },
]

const efficiencyMetrics = [
  { dept: 'CT室', revenue: 428000, cost: 218000, profit: 210000, staff: 6, perCapita: 71000 },
  { dept: 'MR室', revenue: 296000, cost: 165000, profit: 131000, staff: 5, perCapita: 59200 },
  { dept: 'DR室', revenue: 98000, cost: 48000, profit: 50000, staff: 4, perCapita: 24500 },
  { dept: 'DSA室', revenue: 156000, cost: 92000, profit: 64000, staff: 3, perCapita: 52000 },
  { dept: '钼靶室', revenue: 28000, cost: 15000, profit: 13000, staff: 2, perCapita: 14000 },
  { dept: '造影室', revenue: 42000, cost: 22000, profit: 20000, staff: 2, perCapita: 20000 },
]

// ============================================================
// 设备效率扩展数据（开机率、检查完成时间、预约等待时间）
// ============================================================
const deviceStartupData = DEVICE_MASTER.slice(0, 9).map((d) => ({
  name: d.model,
  startupRate: Math.round((100 - d.defectRate * 50) * 10) / 10,
  avgStartupTime: Math.round(d.avgScanDurationMin * 0.5),
  faults: Math.round(d.defectRate * 100),
  status: d.status === '运行中' ? '正常' : d.status === '维护中' ? '维护中' : '待机',
}))

const examCompletionTimeData = DEVICE_MASTER.slice(0, 9).map((d) => ({
  name: d.model,
  completedToday: Math.round(d.monthlyScans / 30),
  avgTime: Math.round(d.avgScanDurationMin),
  minTime: Math.max(5, Math.round(d.avgScanDurationMin * 0.7)),
  maxTime: Math.round(d.avgScanDurationMin * 1.6),
  overtimeCount: Math.round(d.monthlyDowntime / 8),
}))

const appointmentWaitData = [
  { modality: 'CT', avgWait: 2.5, maxWait: 5, todayAppointments: 168, completed: 142, pending: 26 },
  { modality: 'MR', avgWait: 4.2, maxWait: 8, todayAppointments: 85, completed: 68, pending: 17 },
  { modality: 'DR', avgWait: 0.8, maxWait: 2, todayAppointments: 285, completed: 195, pending: 90 },
  { modality: 'DSA', avgWait: 6.5, maxWait: 12, todayAppointments: 15, completed: 12, pending: 3 },
  { modality: 'MG', avgWait: 1.5, maxWait: 3, todayAppointments: 28, completed: 22, pending: 6 },
  { modality: 'GI', avgWait: 3.8, maxWait: 7, todayAppointments: 18, completed: 15, pending: 3 },
]

const waitTimeTrendData = [
  { slot: '08:00-10:00', CT: 1.2, MR: 2.5, DR: 0.5 },
  { slot: '10:00-12:00', CT: 3.2, MR: 5.1, DR: 1.0 },
  { slot: '12:00-14:00', CT: 2.8, MR: 4.5, DR: 0.8 },
  { slot: '14:00-16:00', CT: 2.0, MR: 3.8, DR: 0.6 },
  { slot: '16:00-18:00', CT: 1.5, MR: 2.8, DR: 0.4 },
]

function getRevenueByModality() {
  const colors: Record<string, string> = { 'CT': '#3b82f6', 'MR': '#8b5cf6', 'DR': '#22c55e', 'DSA': '#f59e0b', 'MG': '#ec4899', 'US': '#14b8a6' };
  const priceByModality: Record<string, number> = { 'CT': 400, 'MR': 800, 'DR': 80, 'DSA': 3500, 'MG': 200, 'US': 120 };
  const out: { name: string; value: number; color: string }[] = [];
  ['CT', 'MR', 'DR', 'DSA', 'MG', 'US'].forEach((mod) => {
    const devices = DEVICE_MASTER.filter((d) => d.modality === mod);
    const revenue = devices.reduce((sum, d) => sum + d.monthlyScans * (priceByModality[mod] || 200), 0);
    out.push({ name: mod, value: Math.round(revenue), color: colors[mod] || '#64748b' });
  });
  return out.filter((m) => m.value > 0);
}
const revenueByModality = getRevenueByModality()

function getExamTypeRevenue() {
  // 用 EXAM_ITEM_MASTER 价格 × 估算检查数
  return EXAM_ITEM_MASTER.slice(0, 8).map((e, idx) => {
    const estExams = e.modality === 'CT' ? 80 + ((idx * 17 + 5) % 80)
                   : e.modality === 'MR' ? 30 + ((idx * 13 + 7) % 50)
                   : e.modality === 'DR' ? 200 + ((idx * 11 + 3) % 300)
                   : e.modality === 'DSA' ? 10 + ((idx * 19 + 11) % 30)
                   : 20 + ((idx * 7 + 13) % 30);
    return {
      type: e.name,
      revenue: estExams * e.priceRMB,
      exams: estExams,
    };
  });
}
const examTypeRevenue = getExamTypeRevenue()

const deptRevenueTarget = [
  { dept: 'CT室', target: 500000, actual: 428000, rate: 85.6 },
  { dept: 'MR室', target: 350000, actual: 296000, rate: 84.6 },
  { dept: 'DR室', target: 120000, actual: 98000, rate: 81.7 },
  { dept: 'DSA室', target: 180000, actual: 156000, rate: 86.7 },
  { dept: '钼靶室', target: 35000, actual: 28000, rate: 80.0 },
  { dept: '造影室', target: 50000, actual: 42000, rate: 84.0 },
]

// [G005 Wave2B P2] 导出数据 = 当前统计各维度聚合 (替代 data={[]} 空导出)
function buildStatisticsExportRows(): any[] {
  const rows: any[] = []
  sevenDayData.forEach((d) => rows.push({ 维度: '近7日趋势', 日期: d.day, 检查量: d.exams, 报告量: d.reports, 危急值: d.critical, 收入: d.revenue }))
  timeSlotData.forEach((d) => rows.push({ 维度: '时段分布', 时段: d.slot, 检查量: d.exams }))
  bodyPartData.forEach((d) => rows.push({ 维度: '检查部位', 部位: d.part, 检查量: d.count }))
  doctorWorkloadData.forEach((d) => rows.push({ 维度: '医生工作量', 医生: d.name, 书写: d.written, 审核: d.reviewed, 平均耗时: d.avgTime }))
  positiveRateData.forEach((d) => rows.push({ 维度: '阳性率', 模态: d.modality, 阳性率: d.rate }))
  deviceEfficiencyData.forEach((d) => rows.push({ 维度: '设备效率', 设备: d.name, 日均检查: d.exams, 使用率: d.utilization, 状态: d.status }))
  revenueByModality.forEach((d) => rows.push({ 维度: '收入构成', 模态: d.name, 收入: d.value }))
  return rows
}

// ============================================================
// 通用卡片组件
// ============================================================
function StatCard({ label, value, subValue, icon, color, bg, trend }: {
  label: string; value: string | number; subValue?: string; icon: React.ReactNode;
  color: string; bg: string; trend?: { value: string; up: boolean };
}) {
  return (
    <Card bordered={false} style={{
      background: C.white, borderRadius: 12, padding: '16px 18px',
      border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between'
    }} styles={{ body: { padding: 0 } }}>
      <div>
        <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 4 }}>{label}</div>
        <div style={{ fontSize: 28, fontWeight: 800, color: C.primary, lineHeight: 1.2 }}>{value}</div>
        {subValue && <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>{subValue}</div>}
        {trend && (
          <div style={{ fontSize: 12, color: trend.up ? C.success : C.danger, marginTop: 4, display: 'flex', alignItems: 'center', gap: 2 }}>
            {trend.up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {trend.value}
          </div>
        )}
      </div>
      <div style={{
        width: 48, height: 48, borderRadius: 12, background: bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center', color
      }}>
        {icon}
      </div>
    </Card>
  )
}

// ============================================================
// 通用图表卡片包装
// ============================================================
function ChartCard({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <Card bordered={false} style={{
      background: C.white, borderRadius: 12, padding: 20,
      border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))'
    }} styles={{ body: { padding: 0 } }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.primary }}>{title}</div>
        {action}
      </div>
      {children}
    </Card>
  )
}

// ============================================================
// 通用选择按钮组
// ============================================================
function TabButton({ tabs, active, onChange }: {
  tabs: { key: string; label: string }[]; active: string; onChange: (k: string) => void
}) {
  return (
    <div style={{ display: 'flex', gap: 4, background: C.background, borderRadius: 8, padding: 4 }}>
      {tabs.map(tab => (
        <button key={tab.key} onClick={() => onChange(tab.key)} style={{
          padding: '6px 14px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600,
          cursor: 'pointer', transition: 'all 0.2s',
          background: active === tab.key ? C.white : 'transparent',
          color: active === tab.key ? C.primary : C.textMuted,
          boxShadow: active === tab.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
        }}>{tab.label}</button>
      ))}
    </div>
  )
}

// ============================================================
// 标签页1：检查量统计
// ============================================================
function ExamVolumeTab() {
  const { t } = useTranslation('v3stats')
  const [timeRange, setTimeRange] = useState('week')
  const [modalityFilter, setModalityFilter] = useState('全部')

  const timeRanges = [
    { key: 'today', label: t('statistics.examVolume.timeRanges.today') },
    { key: 'week', label: t('statistics.examVolume.timeRanges.week') },
    { key: 'month', label: t('statistics.examVolume.timeRanges.month') },
    { key: 'quarter', label: t('statistics.examVolume.timeRanges.quarter') },
    { key: 'year', label: t('statistics.examVolume.timeRanges.year') },
  ]

  const modalities = [t('statistics.examVolume.allModalities'), 'CT', 'MR', 'DR', 'DSA', 'MG', 'GI']

  const stats = {
    total: timeRange === 'today' ? 247 : timeRange === 'week' ? 1916 : timeRange === 'month' ? 5680 : timeRange === 'quarter' ? 17040 : 68160,
    yoy: '+12.3%',
    mom: '+5.8%',
    todayEstimate: 285,
  }

  const mergedData = sevenDayData.map(d => ({
    ...d,
    CT: Math.round(d.exams * 0.42),
    MR: Math.round(d.exams * 0.22),
    DR: Math.round(d.exams * 0.28),
    DSA: Math.round(d.exams * 0.08),
  }))

  return (
    <div>
      {/* 筛选栏 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Calendar size={14} color={C.textMuted} />
          <div style={{ display: 'flex', gap: 4, background: C.background, borderRadius: 8, padding: 4 }}>
            {timeRanges.map(r => (
              <button key={r.key} onClick={() => setTimeRange(r.key)} style={{
                padding: '5px 12px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600,
                cursor: 'pointer', background: timeRange === r.key ? C.white : 'transparent',
                color: timeRange === r.key ? C.primary : C.textMuted,
                boxShadow: timeRange === r.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
              }}>{r.label}</button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Filter size={14} color={C.textMuted} aria-hidden="true" />
          <label htmlFor="modality-filter" style={{ position: 'absolute', left: -9999 }}>{t('statistics.examVolume.filterModality')}</label>
          <select id="modality-filter" aria-label="检查设备筛选" value={modalityFilter} onChange={e => setModalityFilter(e.target.value)} style={{
            padding: '6px 12px', borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 12,
            color: C.text, outline: 'none', background: C.white, cursor: 'pointer'
          }}>
            {modalities.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>

      {/* 统计卡片 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 20 }}>
        <StatCard label={t('statistics.examVolume.total')} value={stats.total.toLocaleString()} subValue={timeRange === 'today' ? t('statistics.examVolume.todayCumulative') : timeRange === 'week' ? t('statistics.examVolume.weekCumulative') : timeRange}
          icon={<Activity size={20} />} color={C.info} bg={C.infoBg} trend={{ value: stats.yoy, up: true }} />
        <StatCard label="同比增长率" value={stats.yoy} subValue="较去年同期"
          icon={<TrendingUp size={20} />} color={C.success} bg={C.successBg} trend={{ value: '+2.1%', up: true }} />
        <StatCard label="环比增长率" value={stats.mom} subValue="较上周期"
          icon={<TrendingDown size={20} />} color={C.warning} bg={C.warningBg} trend={{ value: '-0.5%', up: false }} />
        <StatCard label="今日预计完成" value={stats.todayEstimate} subValue="预计下班前"
          icon={<Target size={20} />} color={C.purple} bg={C.purpleBg} trend={{ value: '+15', up: true }} />
      </div>

      {/* 主图：双Y轴折线图 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', marginBottom: 16 }}>
        <ChartCard title={t('statistics.examVolume.chartTitle')}>
          <ChartContainer height={260}>
            <ComposedChart data={sevenDayData}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="day" tick={{ fontSize: 12, fill: C.textMuted }} />
              <YAxis yAxisId="left" tick={{ fontSize: 12, fill: C.textMuted }} label={{ value: '检查量', angle: -90, position: 'insideLeft', fontSize: 12, fill: C.textMuted }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12, fill: C.textMuted }} domain={[30, 50]} label={{ value: '增长率%', angle: 90, position: 'insideRight', fontSize: 12, fill: C.textMuted }} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: `1px solid ${C.border}` }} />
              <Legend iconSize={10} verticalAlign="bottom" align="center" />
              <Bar yAxisId="left" dataKey="exams" fill="#3b82f6" name="检查量" radius={[4, 4, 0, 0]} opacity={0.7} />
              <Line yAxisId="right" type="monotone" dataKey="critical" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} name="危急值数" />
              <Line yAxisId="right" type="monotone" dataKey="reports" stroke="#22c55e" strokeWidth={2} dot={{ r: 4 }} name="报告数" />
            </ComposedChart>
          </ChartContainer>
        </ChartCard>
      </div>

      {/* 副图区 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* 按设备类型分组柱状图 */}
        <ChartCard title={t('statistics.examVolume.modalityDistribution')}>
          <ChartContainer height={220}>
            <StatBarChart data={mergedData}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="day" tick={{ fontSize: 12, fill: C.textMuted }} />
              <YAxis tick={{ fontSize: 12, fill: C.textMuted }} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: `1px solid ${C.border}` }} />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="CT" stackId="a" fill="#3b82f6" name="CT" radius={[0, 0, 0, 0]} />
              <Bar dataKey="MR" stackId="a" fill="#7c3aed" name="MR" radius={[0, 0, 0, 0]} />
              <Bar dataKey="DR" stackId="a" fill="#22c55e" name="DR" radius={[0, 0, 0, 0]} />
              <Bar dataKey="DSA" stackId="a" fill="#d97706" name="DSA" radius={[4, 4, 0, 0]} />
            </StatBarChart>
          </ChartContainer>
        </ChartCard>

        {/* 按患者类型饼图 */}
        <ChartCard title="患者类型占比分布">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 160, height: 160, flexShrink: 0 }}>
            <ChartContainer height={160} state={patientTypeData.length === 0 ? 'empty' : 'ready'} emptyDescription="暂无患者类型数据">
              <StatPieChart>
                <Pie data={patientTypeData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                  {patientTypeData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              </StatPieChart>
            </ChartContainer>
            </div>
            <div style={{ flex: 1 }}>
              {patientTypeData.map(item => (
                <div key={item.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 0', borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: item.color }} />
                    <span style={{ fontSize: 12, color: C.text }}>{item.name}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: C.primary }}>{item.value}%</span>
                    <div style={{ width: 60, height: 6, background: C.background, borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${item.value}%`, height: '100%', background: item.color, borderRadius: 3 }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </ChartCard>
      </div>

      {/* 副图2区 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* 检查部位分布 */}
        <ChartCard title="检查部位分布（前10）">
          <ChartContainer height={220} state={bodyPartData.length === 0 ? 'empty' : 'ready'} emptyDescription="暂无部位分布数据">
            <StatBarChart data={bodyPartData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 12, fill: C.textMuted }} />
              <YAxis dataKey="part" type="category" tick={{ fontSize: 12, fill: C.textMuted }} width={60} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: `1px solid ${C.border}` }} />
              <Bar dataKey="count" fill="#3b82f6" name="检查量" radius={[0, 4, 4, 0]}>
                {bodyPartData.map((_, i) => <Cell key={i} fill={MODALITY_COLORS[['CT', 'MR', 'DR', 'DSA', 'MG', 'GI'][i % 6]]} />)}
              </Bar>
            </StatBarChart>
          </ChartContainer>
        </ChartCard>

        {/* 时段分布 */}
        <ChartCard title="检查时段分布">
          <ChartContainer height={220} state={timeSlotData.length === 0 ? 'empty' : 'ready'} emptyDescription="暂无时段分布数据">
            <StatBarChart data={timeSlotData}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="slot" tick={{ fontSize: 12, fill: C.textMuted }} />
              <YAxis tick={{ fontSize: 12, fill: C.textMuted }} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: `1px solid ${C.border}` }} />
              <Bar dataKey="exams" name="检查量" radius={[4, 4, 0, 0]}>
                {timeSlotData.map((_, i) => <Cell key={i} fill={RAD_COLORS[i % RAD_COLORS.length]} />)}
              </Bar>
            </StatBarChart>
          </ChartContainer>
        </ChartCard>
      </div>
    </div>
  )
}

// ============================================================
// 标签页2：工作量统计
// ============================================================
function WorkloadTab() {
  const { t } = useTranslation('v3stats')
  const [doctorFilter, setDoctorFilter] = useState('全部')
  const [dimension, setDimension] = useState('doctor')
  const [viewMode, setViewMode] = useState('table')

  const doctors = [t('statistics.examVolume.allModalities'), '李明辉', '王秀峰', '张海涛', '刘芳']
  const dimensions = [
    { key: 'doctor', label: t('statistics.workload.dimensions.doctor') },
    { key: 'device', label: t('statistics.workload.dimensions.device') },
    { key: 'room', label: t('statistics.workload.dimensions.room') },
    { key: 'type', label: t('statistics.workload.dimensions.type') },
  ]

  const topDoctors = [...doctorWorkloadData].sort((a, b) => b.written - a.written).slice(0, 5)

  const tableHeaders = [t('statistics.workload.doctorName'), t('statistics.workload.writtenReports'), t('statistics.workload.reviewedReports'), t('statistics.workload.avgTime'), t('statistics.workload.overtimeReports'), t('statistics.workload.criticalReports')]

  return (
    <div>
      {/* 筛选栏 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <UserCheck size={14} color={C.textMuted} aria-hidden="true" />
          <label htmlFor="doctor-filter" style={{ position: 'absolute', left: -9999 }}>医生筛选</label>
          <select id="doctor-filter" aria-label="医生筛选" value={doctorFilter} onChange={e => setDoctorFilter(e.target.value)} style={{
            padding: '6px 12px', borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 12,
            color: C.text, outline: 'none', background: C.white, cursor: 'pointer'
          }}>
            {doctors.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <BarChart3 size={14} color={C.textMuted} />
          <TabButton tabs={dimensions} active={dimension} onChange={setDimension} />
        </div>
      </div>

      {/* 医生工作量表格 */}
      <Card bordered={false} style={{ background: C.white, borderRadius: 12, border: '1px solid var(--border-color)', marginBottom: 20, overflow: 'hidden' }} styles={{ body: { padding: 0 } }}>
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.primary }}>工作量统计报表</div>
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={() => setViewMode('table')} style={{
              padding: '4px 10px', borderRadius: 4, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              background: viewMode === 'table' ? C.infoBg : 'transparent', color: viewMode === 'table' ? C.info : C.textMuted
            }}>表格</button>
            <button onClick={() => setViewMode('chart')} style={{
              padding: '4px 10px', borderRadius: 4, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              background: viewMode === 'chart' ? C.infoBg : 'transparent', color: viewMode === 'chart' ? C.info : C.textMuted
            }}>图表</button>
          </div>
        </div>
        {viewMode === 'table' ? (
          <div style={{ overflowX: "auto" }}><table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: C.background }}>
                {tableHeaders.map(h => (
                  <th key={h} style={{ padding: '10px 16px', fontSize: 12, fontWeight: 700, color: C.textMuted, textAlign: 'center', borderBottom: `1px solid ${C.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {doctorWorkloadData.filter(d => doctorFilter === '全部' || d.name === doctorFilter).map((d, i) => (
                <tr key={d.name} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: '12px 16px', fontSize: 12, fontWeight: 600, color: C.primary, textAlign: 'center' }}>{d.name}</td>
                  <td style={{ padding: '12px 16px', fontSize: 12, textAlign: 'center' }}>{d.written}</td>
                  <td style={{ padding: '12px 16px', fontSize: 12, textAlign: 'center' }}>{d.reviewed}</td>
                  <td style={{ padding: '12px 16px', fontSize: 12, textAlign: 'center' }}>{d.avgTime}min</td>
                  <td style={{ padding: '12px 16px', fontSize: 12, textAlign: 'center', color: d.overtime > 3 ? C.danger : C.text }}>{d.overtime}</td>
                  <td style={{ padding: '12px 16px', fontSize: 12, textAlign: 'center', color: d.critical > 10 ? C.warning : C.success }}>{d.critical}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        ) : (
          <div style={{ padding: 20 }}>
          <ChartContainer height={280} state={doctorWorkloadData.length === 0 ? 'empty' : 'ready'} emptyDescription="暂无医师工作量数据">
            <StatBarChart data={doctorWorkloadData}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: C.textMuted }} />
                <YAxis tick={{ fontSize: 12, fill: C.textMuted }} />
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: `1px solid ${C.border}` }} />
                <Legend iconSize={10} verticalAlign="bottom" align="center" />
                <Bar dataKey="written" fill="#3b82f6" name="书写报告数" radius={[4, 4, 0, 0]} />
                <Bar dataKey="reviewed" fill="#8b5cf6" name="审核报告数" radius={[4, 4, 0, 0]} />
              </StatBarChart>
            </ChartContainer>
          </div>
        )}
      </Card>

      {/* 7天趋势图 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', marginBottom: 20 }}>
        <ChartCard title="各医生7天报告量趋势">
          <ChartContainer height={260} state={doctorTrendData.length === 0 ? 'empty' : 'ready'} emptyDescription="暂无医师趋势数据">
            <LineChart data={doctorTrendData}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="day" tick={{ fontSize: 12, fill: C.textMuted }} />
              <YAxis tick={{ fontSize: 12, fill: C.textMuted }} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: `1px solid ${C.border}` }} />
              <Legend iconSize={10} verticalAlign="bottom" align="center" />
              <Line type="monotone" dataKey="李明辉" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="王秀峰" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="张海涛" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="刘芳" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ChartContainer>
        </ChartCard>
      </div>

      {/* TOP10排行榜 */}
      <Card bordered={false} style={{ background: C.white, borderRadius: 12, border: '1px solid var(--border-color)', padding: 20 }} styles={{ body: { padding: 0 } }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.primary }}>工作量TOP10医生排行榜</div>
          <Award size={16} color={C.warning} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
          {topDoctors.map((d, idx) => (
            <div key={d.name} style={{
              background: idx === 0 ? 'var(--color-warning-bg)' : idx === 1 ? 'var(--bg-primary)' : 'var(--bg-card)',
              borderRadius: 12, padding: 14, textAlign: 'center', border: '1px solid var(--border-color)'
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: idx === 0 ? 'var(--color-warning-bg)' : idx === 1 ? 'var(--border-color)' : C.background,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 8px', fontSize: 14, fontWeight: 800,
                color: idx === 0 ? C.warning : C.textMuted
              }}>
                {idx + 1}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.primary }}>{d.name}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: C.info, marginTop: 6 }}>{d.written}</div>
              <div style={{ fontSize: 12, color: C.textMuted }}>份报告</div>
              <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>均分{d.avgTime}min</div>
              {idx === 0 && <div style={{ fontSize: 12, color: C.warning, marginTop: 2 }}>★ 本月之星</div>}
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

// ============================================================
// 标签页3：收入统计
// ============================================================
function RevenueTab() {
  const { t } = useTranslation('v3stats')
  const [timeRange, setTimeRange] = useState('week')
  const [chartView, setChartView] = useState('7days')

  const timeRanges = [
    { key: '7days', label: t('statistics.revenue.timeRanges.7days') },
    { key: '30days', label: t('statistics.revenue.timeRanges.30days') },
  ]

  const revenueStats = {
    today: 89600,
    week: 628000,
    month: 2680000,
    quarter: 8040000,
    yoy: '+15.6%',
  }

  const revenueTrend7 = sevenDayData.map(d => ({ day: d.day, revenue: d.revenue }))
  const revenueTrend30 = Array.from({ length: 30 }, (_, i) => ({
    day: `Day${i + 1}`,
    revenue: 85000 + ((i * 937 + 123) % 30000)
  }))

  const maxRevenue = Math.max(...(chartView === '7days' ? revenueTrend7 : revenueTrend30).map(d => d.revenue))

  return (
    <div>
      {/* 时间筛选 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Calendar size={14} color={C.textMuted} />
          <TabButton tabs={timeRanges} active={chartView} onChange={setChartView} />
        </div>
        <button onClick={handleExportReport} style={{
          padding: '6px 14px', background: C.white, color: C.textMuted,
          border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 12, fontWeight: 600,
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
        }}>
          <Download size={13} /> 导出报表
        </button>
      </div>

      {/* 收入统计卡片 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 20 }}>
        <StatCard label="今日收入" value={`¥${(revenueStats.today / 10000).toFixed(1)}万`}
          icon={<DollarSign size={20} />} color={C.success} bg={C.successBg}
          trend={{ value: '+8.2%', up: true }} />
        <StatCard label="本周收入" value={`¥${(revenueStats.week / 10000).toFixed(0)}万`}
          icon={<TrendingUp size={20} />} color={C.info} bg={C.infoBg}
          trend={{ value: '+12.5%', up: true }} />
        <StatCard label="本月收入" value={`¥${(revenueStats.month / 10000).toFixed(0)}万`}
          icon={<BarChart3 size={20} />} color={C.warning} bg={C.warningBg}
          trend={{ value: '+15.6%', up: true }} />
        <StatCard label="本季度收入" value={`¥${(revenueStats.quarter / 10000).toFixed(0)}万`}
          icon={<Activity size={20} />} color={C.purple} bg={C.purpleBg}
          trend={{ value: '+18.3%', up: true }} />
        <StatCard label="同比增长率" value={revenueStats.yoy}
          icon={<Target size={20} />} color={C.danger} bg={C.dangerBg}
          trend={{ value: '+3.2%', up: true }} />
      </div>

      {/* 收入趋势面积图 */}
      <div style={{ marginBottom: 16 }}>
        <ChartCard title="收入趋势（万元）">
          <ChartContainer height={280} state={(chartView === '7days' ? revenueTrend7 : revenueTrend30).length === 0 ? 'empty' : 'ready'} emptyDescription="暂无收入趋势数据">
            <AreaChart data={chartView === '7days' ? revenueTrend7 : revenueTrend30}>
              <defs>
                <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="day" tick={{ fontSize: 12, fill: C.textMuted }} />
              <YAxis tick={{ fontSize: 12, fill: C.textMuted }} domain={[0, maxRevenue * 1.2]} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: `1px solid ${C.border}` }}
                formatter={(value: number) => [`¥${(value / 10000).toFixed(1)}万`, '收入']} />
              <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} fill="url(#revenueGradient)" name="收入" />
            </AreaChart>
          </ChartContainer>
        </ChartCard>
      </div>

      {/* 下半区 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* 按设备类型收入分布 */}
        <ChartCard title="按设备类型收入分布">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 150, height: 150, flexShrink: 0 }}>
            <ChartContainer height={150} state={revenueByModality.length === 0 ? 'empty' : 'ready'} emptyDescription="暂无模态收入数据">
              <StatPieChart>
                <Pie data={revenueByModality} cx="50%" cy="50%" innerRadius={42} outerRadius={65} paddingAngle={2} dataKey="value">
                  {revenueByModality.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} formatter={(v: number) => `¥${(v / 10000).toFixed(0)}万`} />
              </StatPieChart>
            </ChartContainer>
            </div>
            <div style={{ flex: 1 }}>
              {revenueByModality.map(item => (
                <div key={item.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0', borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.color }} />
                    <span style={{ fontSize: 12, color: C.text }}>{item.name}</span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: C.primary }}>¥{(item.value / 10000).toFixed(0)}万</span>
                </div>
              ))}
            </div>
          </div>
        </ChartCard>

        {/* 检查类型收入排名 */}
        <ChartCard title="检查类型收入排名">
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            {examTypeRevenue.map((item, i) => (
              <div key={item.type} style={{ display: 'flex', alignItems: 'center', padding: '6px 0', borderBottom: `1px solid ${C.border}` }}>
                <div style={{ width: 18, height: 18, borderRadius: 4, background: i < 3 ? RAD_COLORS[i] : C.background, color: i < 3 ? C.white : C.textMuted, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
                  {i + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: C.text, fontWeight: 600 }}>{item.type}</div>
                  <div style={{ fontSize: 12, color: C.textMuted }}>{item.exams}例检查</div>
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.primary }}>¥{(item.revenue / 10000).toFixed(0)}万</div>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>

      {/* 科室收入目标进度 */}
      <ChartCard title="各科室收入目标达成进度">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
          {deptRevenueTarget.map(dept => (
            <div key={dept.dept} style={{ padding: '12px 0', borderBottom: `1px solid ${C.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{dept.dept}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: dept.rate >= 80 ? C.success : C.warning }}>
                  {dept.rate.toFixed(1)}%
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, height: 8, background: C.background, borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${dept.rate}%`, height: '100%', background: dept.rate >= 80 ? C.success : C.warning, borderRadius: 4 }} />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                <span style={{ fontSize: 12, color: C.textMuted }}>实际: ¥{(dept.actual / 10000).toFixed(0)}万</span>
                <span style={{ fontSize: 12, color: C.textMuted }}>目标: ¥{(dept.target / 10000).toFixed(0)}万</span>
              </div>
            </div>
          ))}
        </div>
      </ChartCard>
    </div>
  )
}

// ============================================================
// 标签页4：质量控制
// ============================================================
function QualityControlTab() {
  const { t } = useTranslation('v3stats')
  const [trendRange, setTrendRange] = useState('7days')

  const qualityStats = {
    avgScore: 96.8,
    overtimeCount: overtimeData.total,
    overtimeRate: overtimeData.rate,
    avgOvertime: overtimeData.avgHours,
    criticalCount: 45,
    timelyRate: overtimeData.timelyRate,
    criticalTimelyRate: 97.8,
    criticalOvertime: 3,
  }

  const trendData = trendRange === '7days' ? qualityScoreData : Array.from({ length: 30 }, (_, i) => ({
    day: `Day${i + 1}`,
    score: 95 + ((i * 7 + 3) % 30) / 10
  }))

  return (
    <div>
      {/* 质控概览卡片 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 20 }}>
        <StatCard label="平均质控评分" value={`${qualityStats.avgScore}分`}
          subValue="满分100分" icon={<Award size={20} />} color={C.success} bg={C.successBg}
          trend={{ value: '+1.2分', up: true }} />
        <StatCard label="超时报告数" value={qualityStats.overtimeCount}
          subValue={`超时率 ${qualityStats.overtimeRate}%`} icon={<Clock size={20} />} color={C.warning} bg={C.warningBg}
          trend={{ value: '-8%', up: true }} />
        <StatCard label="危急值上报数" value={qualityStats.criticalCount}
          subValue="处理及时率 97.8%" icon={<AlertTriangle size={20} />} color={C.danger} bg={C.dangerBg}
          trend={{ value: '+5例', up: false }} />
        <StatCard label="报告修改率" value="12.3%"
          subValue="较上月下降 2.1%" icon={<Edit3 size={20} />} color={C.purple} bg={C.purpleBg}
          trend={{ value: '-2.1%', up: true }} />
      </div>

      {/* 质量评分分布 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <ChartCard title="报告质量评分分布">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 150, height: 150, flexShrink: 0 }}>
            <ChartContainer height={150} state={qualityDistribution.length === 0 ? 'empty' : 'ready'} emptyDescription="暂无质量分布数据">
              <StatPieChart>
                <Pie data={qualityDistribution} cx="50%" cy="50%" innerRadius={42} outerRadius={65} paddingAngle={2} dataKey="value">
                  {qualityDistribution.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              </StatPieChart>
            </ChartContainer>
            </div>
            <div style={{ flex: 1 }}>
              {qualityDistribution.map(item => (
                <div key={item.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 0', borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: item.color }} />
                    <span style={{ fontSize: 12, color: C.text }}>{item.name}</span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: C.primary }}>{item.value}%</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 8 }}>评分分布进度</div>
            {qualityDistribution.map(item => (
              <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <div style={{ width: 50, fontSize: 12, color: C.textMuted }}>{item.name}</div>
                <div style={{ flex: 1, height: 6, background: C.background, borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${item.value}%`, height: '100%', background: item.color, borderRadius: 3 }} />
                </div>
                <div style={{ width: 30, fontSize: 12, color: C.text, textAlign: 'right' }}>{item.value}%</div>
              </div>
            ))}
          </div>
        </ChartCard>

        {/* 超时与危急值统计 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Card bordered={false} style={{ background: C.white, borderRadius: 12, padding: 16, border: '1px solid var(--border-color)' }} styles={{ body: { padding: 0 } }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Clock size={16} color={C.warning} />
              <span style={{ fontSize: 12, fontWeight: 700, color: C.primary }}>超时统计</span>
            </div>
            <div style={{ fontSize: 26, fontWeight: 700, color: C.warning }}>{overtimeData.total}</div>
            <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 8 }}>超时报告总数</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
              <span style={{ fontSize: 12, color: C.textMuted }}>超时率</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.warning }}>{overtimeData.rate}%</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
              <span style={{ fontSize: 12, color: C.textMuted }}>平均超时</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{overtimeData.avgHours}h</span>
            </div>
          </Card>
          <Card bordered={false} style={{ background: C.white, borderRadius: 12, padding: 16, border: '1px solid var(--border-color)' }} styles={{ body: { padding: 0 } }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <AlertTriangle size={16} color={C.danger} />
              <span style={{ fontSize: 12, fontWeight: 700, color: C.primary }}>危急值统计</span>
            </div>
            <div style={{ fontSize: 26, fontWeight: 700, color: C.danger }}>{qualityStats.criticalCount}</div>
            <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 8 }}>本月上报表数</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
              <span style={{ fontSize: 12, color: C.textMuted }}>处理及时率</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.success }}>{qualityStats.criticalTimelyRate}%</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
              <span style={{ fontSize: 12, color: C.textMuted }}>超时处理</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.danger }}>{qualityStats.criticalOvertime}例</span>
            </div>
          </Card>
        </div>
      </div>

      {/* 报告修改次数分布 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <ChartCard title="报告修改次数分布">
          <ChartContainer height={200} state={modificationData.length === 0 ? 'empty' : 'ready'} emptyDescription="暂无报告修改数据">
            <StatBarChart data={modificationData}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="times" tick={{ fontSize: 12, fill: C.textMuted }} />
              <YAxis tick={{ fontSize: 12, fill: C.textMuted }} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: `1px solid ${C.border}` }} />
              <Bar dataKey="count" name="报告数" radius={[4, 4, 0, 0]}>
                {modificationData.map((_, i) => <Cell key={i} fill={RAD_COLORS[i]} />)}
              </Bar>
            </StatBarChart>
          </ChartContainer>
        </ChartCard>

        <ChartCard title="超时率与及时率趋势">
          <ChartContainer height={200} state={sevenDayData.length === 0 ? 'empty' : 'ready'} emptyDescription="暂无7日数据">
            <LineChart data={sevenDayData}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="day" tick={{ fontSize: 12, fill: C.textMuted }} />
              <YAxis tick={{ fontSize: 12, fill: C.textMuted }} domain={[0, 10]} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: `1px solid ${C.border}` }} />
              <Legend iconSize={10} verticalAlign="bottom" align="center" />
              <Line type="monotone" dataKey="critical" stroke="#dc2626" strokeWidth={2} dot={{ r: 3 }} name="危急值数" />
            </LineChart>
          </ChartContainer>
        </ChartCard>
      </div>

      {/* 质控评分趋势 */}
      <ChartCard
        title="质控评分趋势"
        action={
          <div style={{ display: 'flex', gap: 4 }}>
            {['7days', '30days'].map(r => (
              <button key={r} onClick={() => setTrendRange(r)} style={{
                padding: '4px 10px', borderRadius: 4, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: trendRange === r ? C.infoBg : 'transparent', color: trendRange === r ? C.info : C.textMuted
              }}>{r === '7days' ? '7天' : '30天'}</button>
            ))}
          </div>
        }
      >
          <ChartContainer height={240} state={trendData.length === 0 ? 'empty' : 'ready'} emptyDescription="暂无趋势数据">
            <LineChart data={trendData}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
            <XAxis dataKey="day" tick={{ fontSize: 12, fill: C.textMuted }} />
            <YAxis tick={{ fontSize: 12, fill: C.textMuted }} domain={[93, 100]} />
            <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: `1px solid ${C.border}` }} />
            <Line type="monotone" dataKey="score" stroke="#059669" strokeWidth={2} dot={{ r: 3 }} name="质控评分" />
          </LineChart>
        </ChartContainer>
      </ChartCard>
    </div>
  )
}

// ============================================================
// 标签页5：设备效能（扩充版）
// ============================================================
function DeviceEfficiencyTab() {
  const { t } = useTranslation('v3stats')
  const [deviceFilter, setDeviceFilter] = useState('全部')
  const [deviceView, setDeviceView] = useState('utilization')

  const tableHeaders = ['设备名称', '类型', '检查量', '平均时长', '设备利用率', '故障次数', '维保状态']
  const extendedHeaders = ['设备名称', '今日完成', '平均时间', '最短', '最长', '超时数', '状态']

  const utilizationAvg = Math.round(deviceEfficiencyData.reduce((sum, d) => sum + d.utilization, 0) / deviceEfficiencyData.length)
  const startupAvg = Math.round(deviceStartupData.reduce((sum, d) => sum + d.startupRate, 0) / deviceStartupData.length)
  const waitAvg = (appointmentWaitData.reduce((sum, d) => sum + d.avgWait, 0) / appointmentWaitData.length).toFixed(1)

  return (
    <div>
      {/* 设备效能概览 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 20 }}>
        <StatCard label="设备总数" value={deviceEfficiencyData.length}
          subValue="运行中 8 台" icon={<Monitor size={20} />} color={C.info} bg={C.infoBg} />
        <StatCard label="平均利用率" value={`${utilizationAvg}%`}
          subValue="目标 > 80%" icon={<Percent size={20} />} color={C.success} bg={C.successBg}
          trend={{ value: '+3.2%', up: true }} />
        <StatCard label="平均开机率" value={`${startupAvg}%`}
          subValue="目标 > 95%" icon={<Zap size={20} />} color={C.purple} bg={C.purpleBg}
          trend={{ value: '+1.5%', up: true }} />
        <StatCard label="平均预约等待" value={`${waitAvg}天`}
          subValue="CT/MR较繁忙" icon={<Clock size={20} />} color={C.warning} bg={C.warningBg}
          trend={{ value: '+0.3天', up: false }} />
        <StatCard label="故障总次数" value={deviceEfficiencyData.reduce((s, d) => s + d.faults, 0)}
          subValue="维保中 1 台" icon={<Wrench size={20} />} color={C.danger} bg={C.dangerBg}
          trend={{ value: '-2次', up: true }} />
      </div>

      {/* 设备视图切换 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 4, background: C.background, borderRadius: 8, padding: 4 }}>
          {[{ key: 'utilization', label: '利用率' }, { key: 'startup', label: '开机率' }, { key: 'completion', label: '完成时间' }, { key: 'wait', label: '等待时间' }].map(v => (
            <button key={v.key} onClick={() => setDeviceView(v.key)} style={{
              padding: '5px 12px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600,
              cursor: 'pointer', background: deviceView === v.key ? C.white : 'transparent',
              color: deviceView === v.key ? C.primary : C.textMuted,
              boxShadow: deviceView === v.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
            }}>{v.label}</button>
          ))}
        </div>
        <label htmlFor="device-filter" style={{ position: 'absolute', left: -9999 }}>设备类型筛选</label>
        <select id="device-filter" aria-label="设备类型筛选" value={deviceFilter} onChange={e => setDeviceFilter(e.target.value)} style={{
          padding: '6px 12px', borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 12,
          color: C.text, outline: 'none', background: C.white, cursor: 'pointer'
        }}>
          {['全部', 'CT', 'MR', 'DR', 'DSA', 'MG', 'GI'].map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      {/* 设备利用率视图 */}
      {deviceView === 'utilization' && (
        <>
          <Card bordered={false} style={{ background: C.white, borderRadius: 12, border: '1px solid var(--border-color)', marginBottom: 20, overflow: 'hidden' }} styles={{ body: { padding: 0 } }}>
            <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.primary }}>设备列表</div>
            </div>
            <div style={{ overflowX: "auto" }}><table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: C.background }}>
                  {tableHeaders.map(h => (
                    <th key={h} style={{ padding: '10px 16px', fontSize: 12, fontWeight: 700, color: C.textMuted, textAlign: 'center', borderBottom: `1px solid ${C.border}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {deviceEfficiencyData.filter(d => deviceFilter === '全部' || d.name.includes(deviceFilter)).map(d => (
                  <tr key={d.name} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ padding: '12px 16px', fontSize: 12, fontWeight: 600, color: C.primary, textAlign: 'center' }}>{d.name}</td>
                    <td style={{ padding: '12px 16px', fontSize: 12, textAlign: 'center' }}>{d.name.split('-')[0]}</td>
                    <td style={{ padding: '12px 16px', fontSize: 12, textAlign: 'center', fontWeight: 700, color: C.info }}>{d.exams}</td>
                    <td style={{ padding: '12px 16px', fontSize: 12, textAlign: 'center' }}>{d.avgTime}min</td>
                    <td style={{ padding: '12px 16px', fontSize: 12, textAlign: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                        <div style={{ width: 60, height: 6, background: C.background, borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ width: `${d.utilization}%`, height: '100%', background: d.utilization >= 80 ? C.success : d.utilization >= 60 ? C.warning : C.danger, borderRadius: 3 }} />
                        </div>
                        <span style={{ fontWeight: 700, color: d.utilization >= 80 ? C.success : d.utilization >= 60 ? C.warning : C.danger }}>{d.utilization}%</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 12, textAlign: 'center', color: d.faults > 0 ? C.danger : C.success }}>{d.faults}</td>
                    <td style={{ padding: '12px 16px', fontSize: 12, textAlign: 'center' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600,
                        background: d.status === '正常' ? C.successBg : C.warningBg,
                        color: d.status === '正常' ? C.success : C.warning
                      }}>{d.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </Card>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <ChartCard title="各设备利用率对比">
          <ChartContainer height={240} state={deviceEfficiencyData.length === 0 ? 'empty' : 'ready'} emptyDescription="暂无设备效率数据">
            <StatBarChart data={deviceEfficiencyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: C.textMuted }} />
                  <YAxis tick={{ fontSize: 12, fill: C.textMuted }} domain={[0, 100]} />
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: `1px solid ${C.border}` }} />
                  <Bar dataKey="utilization" name="利用率%" radius={[4, 4, 0, 0]}>
                    {deviceEfficiencyData.map((entry, i) => (
                      <Cell key={i} fill={entry.utilization >= 80 ? C.success : entry.utilization >= 60 ? C.warning : C.danger} />
                    ))}
                  </Bar>
                </StatBarChart>
              </ChartContainer>
            </ChartCard>

            <ChartCard title="维保计划列表">
              <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                {maintenanceData.map(m => (
                  <div key={m.device} style={{ padding: '10px 0', borderBottom: `1px solid ${C.border}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{m.device}</span>
                      <span style={{
                        padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600,
                        background: m.daysLeft <= 14 ? C.dangerBg : m.daysLeft <= 30 ? C.warningBg : C.infoBg,
                        color: m.daysLeft <= 14 ? C.danger : m.daysLeft <= 30 ? C.warning : C.info
                      }}>
                        {m.daysLeft <= 14 ? '紧急' : m.daysLeft <= 30 ? '即将到期' : '正常'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 12, color: C.textMuted }}>{m.type}</span>
                      <span style={{ fontSize: 12, color: C.textMuted }}>剩余 <strong style={{ color: m.daysLeft <= 14 ? C.danger : C.text }}>{m.daysLeft}</strong> 天</span>
                    </div>
                    <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>计划日期: {m.nextDate}</div>
                  </div>
                ))}
              </div>
            </ChartCard>
          </div>
        </>
      )}

      {/* 开机率视图 */}
      {deviceView === 'startup' && (
        <>
          <Card bordered={false} style={{ background: C.white, borderRadius: 12, border: '1px solid var(--border-color)', marginBottom: 20, overflow: 'hidden' }} styles={{ body: { padding: 0 } }}>
            <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.primary }}>设备开机率详情</div>
            </div>
            <div style={{ overflowX: "auto" }}><table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: C.background }}>
                  {['设备名称', '开机率', '平均启动时间', '故障次数', '状态'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', fontSize: 12, fontWeight: 700, color: C.textMuted, textAlign: 'center', borderBottom: `1px solid ${C.border}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {deviceStartupData.filter(d => deviceFilter === '全部' || d.name.includes(deviceFilter)).map(d => (
                  <tr key={d.name} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ padding: '12px 16px', fontSize: 12, fontWeight: 600, color: C.primary, textAlign: 'center' }}>{d.name}</td>
                    <td style={{ padding: '12px 16px', fontSize: 12, textAlign: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                        <div style={{ width: 60, height: 6, background: C.background, borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ width: `${d.startupRate}%`, height: '100%', background: d.startupRate >= 95 ? C.success : d.startupRate >= 90 ? C.warning : C.danger, borderRadius: 3 }} />
                        </div>
                        <span style={{ fontWeight: 700, color: d.startupRate >= 95 ? C.success : d.startupRate >= 90 ? C.warning : C.danger }}>{d.startupRate}%</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 12, textAlign: 'center' }}>{d.avgStartupTime}min</td>
                    <td style={{ padding: '12px 16px', fontSize: 12, textAlign: 'center', color: d.faults > 0 ? C.danger : C.success }}>{d.faults}</td>
                    <td style={{ padding: '12px 16px', fontSize: 12, textAlign: 'center' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600,
                        background: d.status === '正常' ? C.successBg : C.warningBg,
                        color: d.status === '正常' ? C.success : C.warning
                      }}>{d.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </Card>

          <ChartCard title="各设备开机率对比">
          <ChartContainer height={280} state={deviceStartupData.length === 0 ? 'empty' : 'ready'} emptyDescription="暂无设备开机数据">
            <StatBarChart data={deviceStartupData}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: C.textMuted }} />
                <YAxis tick={{ fontSize: 12, fill: C.textMuted }} domain={[80, 100]} />
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: `1px solid ${C.border}` }} />
                <Bar dataKey="startupRate" name="开机率%" radius={[4, 4, 0, 0]}>
                  {deviceStartupData.map((entry, i) => (
                    <Cell key={i} fill={entry.startupRate >= 95 ? C.success : entry.startupRate >= 90 ? C.warning : C.danger} />
                  ))}
                </Bar>
              </StatBarChart>
            </ChartContainer>
          </ChartCard>
        </>
      )}

      {/* 检查完成时间视图 */}
      {deviceView === 'completion' && (
        <>
          <Card bordered={false} style={{ background: C.white, borderRadius: 12, border: '1px solid var(--border-color)', marginBottom: 20, overflow: 'hidden' }} styles={{ body: { padding: 0 } }}>
            <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.primary }}>检查完成时间统计</div>
            </div>
            <div style={{ overflowX: "auto" }}><table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: C.background }}>
                  {extendedHeaders.map(h => (
                    <th key={h} style={{ padding: '10px 16px', fontSize: 12, fontWeight: 700, color: C.textMuted, textAlign: 'center', borderBottom: `1px solid ${C.border}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {examCompletionTimeData.filter(d => deviceFilter === '全部' || d.name.includes(deviceFilter)).map(d => (
                  <tr key={d.name} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ padding: '12px 16px', fontSize: 12, fontWeight: 600, color: C.primary, textAlign: 'center' }}>{d.name}</td>
                    <td style={{ padding: '12px 16px', fontSize: 12, textAlign: 'center', fontWeight: 700, color: C.info }}>{d.completedToday}</td>
                    <td style={{ padding: '12px 16px', fontSize: 12, textAlign: 'center', color: d.avgTime > 40 ? C.warning : C.text }}>{d.avgTime}min</td>
                    <td style={{ padding: '12px 16px', fontSize: 12, textAlign: 'center', color: C.success }}>{d.minTime}min</td>
                    <td style={{ padding: '12px 16px', fontSize: 12, textAlign: 'center', color: C.danger }}>{d.maxTime}min</td>
                    <td style={{ padding: '12px 16px', fontSize: 12, textAlign: 'center', color: d.overtimeCount > 3 ? C.danger : C.text }}>{d.overtimeCount}</td>
                    <td style={{ padding: '12px 16px', fontSize: 12, textAlign: 'center' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600,
                        background: d.overtimeCount === 0 ? C.successBg : d.overtimeCount <= 2 ? C.warningBg : C.dangerBg,
                        color: d.overtimeCount === 0 ? C.success : d.overtimeCount <= 2 ? C.warning : C.danger
                      }}>
                        {d.overtimeCount === 0 ? '正常' : d.overtimeCount <= 2 ? '轻微' : '超时'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </Card>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <ChartCard title="各设备平均检查时间对比">
          <ChartContainer height={240} state={examCompletionTimeData.length === 0 ? 'empty' : 'ready'} emptyDescription="暂无完成时长数据">
            <StatBarChart data={examCompletionTimeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: C.textMuted }} />
                  <YAxis tick={{ fontSize: 12, fill: C.textMuted }} />
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: `1px solid ${C.border}` }} />
                  <Bar dataKey="avgTime" name="平均时间(min)" radius={[4, 4, 0, 0]}>
                    {examCompletionTimeData.map((entry, i) => (
                      <Cell key={i} fill={entry.avgTime <= 15 ? C.success : entry.avgTime <= 30 ? C.warning : C.danger} />
                    ))}
                  </Bar>
                </StatBarChart>
              </ChartContainer>
            </ChartCard>

            <ChartCard title="完成时间分布">
          <ChartContainer height={240} state={examCompletionTimeData.length === 0 ? 'empty' : 'ready'} emptyDescription="暂无完成时长数据">
            <StatBarChart data={examCompletionTimeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: C.textMuted }} />
                  <YAxis tick={{ fontSize: 12, fill: C.textMuted }} />
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: `1px solid ${C.border}` }} />
                  <Legend iconSize={10} verticalAlign="bottom" align="center" />
                  <Bar dataKey="minTime" name="最短时间" fill="#059669" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="maxTime" name="最长时间" fill="#dc2626" radius={[4, 4, 0, 0]} />
                </StatBarChart>
              </ChartContainer>
            </ChartCard>
          </div>
        </>
      )}

      {/* 预约等待时间视图 */}
      {deviceView === 'wait' && (
        <>
          <Card bordered={false} style={{ background: C.white, borderRadius: 12, border: '1px solid var(--border-color)', marginBottom: 20, overflow: 'hidden' }} styles={{ body: { padding: 0 } }}>
            <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.primary }}>预约等待时间统计</div>
            </div>
            <div style={{ overflowX: "auto" }}><table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: C.background }}>
                  {['设备类型', '平均等待', '最长等待', '今日预约', '已完成', '待检查', '完成率'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', fontSize: 12, fontWeight: 700, color: C.textMuted, textAlign: 'center', borderBottom: `1px solid ${C.border}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {appointmentWaitData.map(d => {
                  const completionRate = ((d.completed / d.todayAppointments) * 100).toFixed(1)
                  return (
                    <tr key={d.modality} style={{ borderBottom: `1px solid ${C.border}` }}>
                      <td style={{ padding: '12px 16px', fontSize: 12, fontWeight: 600, color: C.primary, textAlign: 'center' }}>{d.modality}</td>
                      <td style={{ padding: '12px 16px', fontSize: 12, textAlign: 'center', color: d.avgWait > 3 ? C.warning : C.success }}>{d.avgWait}天</td>
                      <td style={{ padding: '12px 16px', fontSize: 12, textAlign: 'center', color: d.maxWait > 7 ? C.danger : C.text }}>{d.maxWait}天</td>
                      <td style={{ padding: '12px 16px', fontSize: 12, textAlign: 'center', fontWeight: 700, color: C.info }}>{d.todayAppointments}</td>
                      <td style={{ padding: '12px 16px', fontSize: 12, textAlign: 'center', color: C.success }}>{d.completed}</td>
                      <td style={{ padding: '12px 16px', fontSize: 12, textAlign: 'center', color: d.pending > 10 ? C.warning : C.text }}>{d.pending}</td>
                      <td style={{ padding: '12px 16px', fontSize: 12, textAlign: 'center' }}>
                        <span style={{
                          padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600,
                          background: parseFloat(completionRate) >= 85 ? C.successBg : parseFloat(completionRate) >= 70 ? C.warningBg : C.dangerBg,
                          color: parseFloat(completionRate) >= 85 ? C.success : parseFloat(completionRate) >= 70 ? C.warning : C.danger
                        }}>{completionRate}%</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table></div>
          </Card>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <ChartCard title="各设备预约等待时间">
          <ChartContainer height={240} state={appointmentWaitData.length === 0 ? 'empty' : 'ready'} emptyDescription="暂无预约等待数据">
            <StatBarChart data={appointmentWaitData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                  <XAxis dataKey="modality" tick={{ fontSize: 12, fill: C.textMuted }} />
                  <YAxis tick={{ fontSize: 12, fill: C.textMuted }} />
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: `1px solid ${C.border}` }} />
                  <Bar dataKey="avgWait" name="平均等待(天)" radius={[4, 4, 0, 0]}>
                    {appointmentWaitData.map((entry, i) => (
                      <Cell key={i} fill={entry.avgWait <= 2 ? C.success : entry.avgWait <= 4 ? C.warning : C.danger} />
                    ))}
                  </Bar>
                </StatBarChart>
              </ChartContainer>
            </ChartCard>

            <ChartCard title="时段等待时间趋势">
          <ChartContainer height={240} state={waitTimeTrendData.length === 0 ? 'empty' : 'ready'} emptyDescription="暂无等待趋势数据">
            <LineChart data={waitTimeTrendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                  <XAxis dataKey="slot" tick={{ fontSize: 12, fill: C.textMuted }} />
                  <YAxis tick={{ fontSize: 12, fill: C.textMuted }} />
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: `1px solid ${C.border}` }} />
                  <Legend iconSize={10} verticalAlign="bottom" align="center" />
                  <Line type="monotone" dataKey="CT" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} name="CT" />
                  <Line type="monotone" dataKey="MR" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} name="MR" />
                  <Line type="monotone" dataKey="DR" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} name="DR" />
                </LineChart>
              </ChartContainer>
            </ChartCard>
          </div>
        </>
      )}

      {/* 设备使用时段热力图 - 显示在利用率视图底部 */}
      {deviceView === 'utilization' && (
        <ChartCard title="设备使用时段热力图（模拟24小时 × 7天）">
          <div style={{ overflowX: 'auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '60px repeat(7, 1fr)', gap: 2, minWidth: 500 }}>
              <div style={{ fontSize: 12, color: C.textMuted, textAlign: 'center', padding: 4 }}></div>
              {['周一', '周二', '周三', '周四', '周五', '周六', '周日'].map(d => (
                <div key={d} style={{ fontSize: 12, color: C.textMuted, textAlign: 'center', padding: 4, fontWeight: 600 }}>{d}</div>
              ))}
              {heatmapData.map(row => (
                <>
                  <div key={`label-${row.hour}`} style={{ fontSize: 12, color: C.textMuted, textAlign: 'center', padding: 4 }}>{row.hour}</div>
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d, i) => {
                    const val = row[d as keyof typeof row] as number
                    const intensity = Math.min(val / 50, 1)
                    return (
                      <div key={`${row.hour}-${d}`} style={{
                        background: `rgba(59, 130, 246, ${intensity})`,
                        borderRadius: 3, padding: '4px 2px', textAlign: 'center', minHeight: 24
                      }}>
                        <span style={{ fontSize: 12, color: intensity > 0.5 ? C.white : C.textMuted, fontWeight: val > 30 ? 700 : 400 }}>{val}</span>
                      </div>
                    )
                  })}
                </>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
            <span style={{ fontSize: 12, color: C.textMuted }}>使用强度:</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 16, height: 10, background: 'rgba(59,130,246,0.1)', borderRadius: 2 }} />
              <span style={{ fontSize: 12, color: C.textMuted }}>低</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 16, height: 10, background: 'rgba(59,130,246,0.4)', borderRadius: 2 }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 16, height: 10, background: 'rgba(59,130,246,0.7)', borderRadius: 2 }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 16, height: 10, background: 'rgba(59,130,246,1)', borderRadius: 2 }} />
              <span style={{ fontSize: 12, color: C.textMuted }}>高</span>
            </div>
          </div>
        </ChartCard>
      )}
    </div>
  )
}

// ============================================================
// 标签页6：患者分析
// ============================================================
function PatientAnalysisTab() {
  const { t } = useTranslation('v3stats')
  const [timeRange, setTimeRange] = useState('week')

  const patientStats = {
    total: 568,
    avgAge: 48.5,
    positiveRate: 38.2,
    criticalCount: 45,
  }

  return (
    <div>
      {/* 患者分析概览 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 20 }}>
        <StatCard label="本月患者数" value={patientStats.total}
          subValue="门诊/住院/体检" icon={<Users size={20} />} color={C.info} bg={C.infoBg}
          trend={{ value: '+6.8%', up: true }} />
        <StatCard label="平均年龄" value={`${patientStats.avgAge}岁`}
          subValue="男女比例 55:45" icon={<UserCheck size={20} />} color={C.purple} bg={C.purpleBg} />
        <StatCard label="总体阳性率" value={`${patientStats.positiveRate}%`}
          subValue="高于全国平均水平" icon={<ShieldCheck size={20} />} color={C.success} bg={C.successBg}
          trend={{ value: '+2.1%', up: false }} />
        <StatCard label="危急患者数" value={patientStats.criticalCount}
          subValue="及时处理率 97.8%" icon={<AlertTriangle size={20} />} color={C.danger} bg={C.dangerBg}
          trend={{ value: '+5例', up: false }} />
      </div>

      {/* 患者来源与年龄分布 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* 患者来源分布 */}
        <ChartCard title="患者来源分布">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 160, height: 160, flexShrink: 0 }}>
            <ChartContainer height={160} state={patientSourceData.length === 0 ? 'empty' : 'ready'} emptyDescription="暂无患者来源数据">
              <StatPieChart>
                <Pie data={patientSourceData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                  {patientSourceData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              </StatPieChart>
            </ChartContainer>
            </div>
            <div style={{ flex: 1 }}>
              {patientSourceData.map(item => (
                <div key={item.source} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: item.color }} />
                    <span style={{ fontSize: 12, color: C.text }}>{item.source}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: C.primary }}>{item.count}%</span>
                    <div style={{ width: 60, height: 6, background: C.background, borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${item.count}%`, height: '100%', background: item.color, borderRadius: 3 }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </ChartCard>

        {/* 性别分布 */}
        <ChartCard title="患者性别分布">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 160, height: 160, flexShrink: 0 }}>
            <ChartContainer height={160} state={genderDistribution.length === 0 ? 'empty' : 'ready'} emptyDescription="暂无性别分布数据">
              <StatPieChart>
                <Pie data={genderDistribution} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                  {genderDistribution.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              </StatPieChart>
            </ChartContainer>
            </div>
            <div style={{ flex: 1 }}>
              {genderDistribution.map(item => (
                <div key={item.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: item.color }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{item.name}</span>
                  </div>
                  <span style={{ fontSize: 18, fontWeight: 800, color: C.primary }}>{item.value}%</span>
                </div>
              ))}
              <div style={{ marginTop: 12, padding: 8, background: C.background, borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 12, color: C.textMuted }}>男女比例</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: C.primary }}>55 : 45</div>
              </div>
            </div>
          </div>
        </ChartCard>
      </div>

      {/* 年龄分布柱状图 */}
      <div style={{ marginBottom: 16 }}>
        <ChartCard title="患者年龄分布">
          <ChartContainer height={240} state={ageDistributionData.length === 0 ? 'empty' : 'ready'} emptyDescription="暂无年龄分布数据">
            <StatBarChart data={ageDistributionData}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="range" tick={{ fontSize: 12, fill: C.textMuted }} />
              <YAxis tick={{ fontSize: 12, fill: C.textMuted }} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: `1px solid ${C.border}` }} />
              <Legend iconSize={10} verticalAlign="bottom" align="center" />
              <Bar dataKey="male" name="男性" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="female" name="女性" fill="#ec4899" radius={[4, 4, 0, 0]} />
            </StatBarChart>
          </ChartContainer>
        </ChartCard>
      </div>

      {/* 阳性率对比与趋势 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* 各设备阳性率 */}
        <ChartCard title="各设备阳性率对比">
          <ChartContainer height={220} state={positiveRateData.length === 0 ? 'empty' : 'ready'} emptyDescription="暂无阳性率数据">
            <StatBarChart data={positiveRateData}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="modality" tick={{ fontSize: 12, fill: C.textMuted }} />
              <YAxis tick={{ fontSize: 12, fill: C.textMuted }} domain={[0, 100]} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: `1px solid ${C.border}` }} />
              <Bar dataKey="rate" name="阳性率%" radius={[4, 4, 0, 0]}>
                {positiveRateData.map((entry, i) => (
                  <Cell key={i} fill={entry.rate >= 50 ? C.danger : entry.rate >= 30 ? C.warning : C.success} />
                ))}
              </Bar>
            </StatBarChart>
          </ChartContainer>
        </ChartCard>

        {/* 阳性率趋势 */}
        <ChartCard title="检查阳性率7天趋势">
          <ChartContainer height={220} state={positiveTrendData.length === 0 ? 'empty' : 'ready'} emptyDescription="暂无阳性趋势数据">
            <LineChart data={positiveTrendData}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="day" tick={{ fontSize: 12, fill: C.textMuted }} />
              <YAxis tick={{ fontSize: 12, fill: C.textMuted }} domain={[30, 50]} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: `1px solid ${C.border}` }} />
              <Line type="monotone" dataKey="rate" stroke="#059669" strokeWidth={2} dot={{ r: 4 }} name="阳性率%" />
            </LineChart>
          </ChartContainer>
        </ChartCard>
      </div>
    </div>
  )
}

// ============================================================
// 标签页：阳性率统计（扩充版）
// ============================================================
function PositiveRateTab() {
  const { t } = useTranslation('v3stats')
  const [timeRange, setTimeRange] = useState('week')
  const [positiveType, setPositiveType] = useState('all')

  const timeRanges = [
    { key: 'today', label: '今日' },
    { key: 'week', label: '本周' },
    { key: 'month', label: '本月' },
  ]

  const positiveStats = {
    overallRate: 38.5,
    yoyChange: '+2.3%',
    momChange: '-1.2%',
    totalExams: 1916,
    positiveCount: 738,
    reexamRate: 5.8,
  }

  return (
    <div>
      {/* 筛选栏 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Calendar size={14} color={C.textMuted} />
          <div style={{ display: 'flex', gap: 4, background: C.background, borderRadius: 8, padding: 4 }}>
            {timeRanges.map(r => (
              <button key={r.key} onClick={() => setTimeRange(r.key)} style={{
                padding: '5px 12px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600,
                cursor: 'pointer', background: timeRange === r.key ? C.white : 'transparent',
                color: timeRange === r.key ? C.primary : C.textMuted,
                boxShadow: timeRange === r.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
              }}>{r.label}</button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Filter size={14} color={C.textMuted} aria-hidden="true" />
          <label htmlFor="positive-type-filter" style={{ position: 'absolute', left: -9999 }}>阳性类型筛选</label>
          <select id="positive-type-filter" aria-label="阳性类型筛选" value={positiveType} onChange={e => setPositiveType(e.target.value)} style={{
            padding: '6px 12px', borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 12,
            color: C.text, outline: 'none', background: C.white, cursor: 'pointer'
          }}>
            <option value="all">全部类型</option>
            <option value="CT">CT</option>
            <option value="MR">MR</option>
            <option value="DR">DR</option>
            <option value="DSA">DSA</option>
          </select>
        </div>
      </div>

      {/* 阳性率概览卡片 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 20 }}>
        <StatCard label="总体阳性率" value={`${positiveStats.overallRate}%`}
          subValue="本月统计" icon={<ShieldCheck size={20} />} color={C.success} bg={C.successBg}
          trend={{ value: positiveStats.momChange, up: false }} />
        <StatCard label="阳性病例数" value={positiveStats.positiveCount}
          subValue={`共 ${positiveStats.totalExams} 例检查`} icon={<AlertTriangle size={20} />} color={C.danger} bg={C.dangerBg}
          trend={{ value: '+32例', up: false }} />
        <StatCard label="复查率" value={`${positiveStats.reexamRate}%`}
          subValue="因图像质量问题" icon={<RefreshCw size={20} />} color={C.warning} bg={C.warningBg}
          trend={{ value: '-0.5%', up: true }} />
        <StatCard label="同比变化" value={positiveStats.yoyChange}
          subValue="较去年同期" icon={<TrendingUp size={20} />} color={C.info} bg={C.infoBg}
          trend={{ value: '+0.8%', up: true }} />
      </div>

      {/* 阳性率趋势图（30天） */}
      <div style={{ marginBottom: 16 }}>
        <ChartCard title="阳性率30天趋势">
          <ChartContainer height={260} state={positiveRateTrend30Days.length === 0 ? 'empty' : 'ready'} emptyDescription="暂无30日阳性率数据">
            <LineChart data={positiveRateTrend30Days}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="day" tick={{ fontSize: 12, fill: C.textMuted }} />
              <YAxis tick={{ fontSize: 12, fill: C.textMuted }} domain={[30, 50]} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: `1px solid ${C.border}` }} />
              <Legend iconSize={10} verticalAlign="bottom" align="center" />
              <Line type="monotone" dataKey="rate" stroke="#059669" strokeWidth={2} dot={{ r: 2 }} name="阳性率%" />
              <Line type="monotone" dataKey="critical" stroke="#dc2626" strokeWidth={1.5} dot={{ r: 2 }} name="危急值数" />
            </LineChart>
          </ChartContainer>
        </ChartCard>
      </div>

      {/* 阳性率排名与复查率 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* 阳性率排名 */}
        <ChartCard title="阳性率排名（前8）">
          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
            {positiveRateRanking.map(item => (
              <div key={item.rank} style={{
                display: 'flex', alignItems: 'center', padding: '8px 0',
                borderBottom: `1px solid ${C.border}`
              }}>
                <div style={{
                  width: 22, height: 22, borderRadius: 6,
                  background: item.rank <= 3 ? RAD_COLORS[item.rank - 1] : C.background,
                  color: item.rank <= 3 ? C.white : C.textMuted,
                  fontSize: 12, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginRight: 10
                }}>
                  {item.rank}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{item.type}</div>
                  <div style={{ fontSize: 12, color: C.textMuted }}>{item.count} 例检查</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: item.rate >= 50 ? C.danger : item.rate >= 30 ? C.warning : C.success }}>
                    {item.rate}%
                  </div>
                  <div style={{ fontSize: 12, color: item.trend.startsWith('↑') ? C.danger : item.trend.startsWith('↓') ? C.success : C.textMuted }}>
                    {item.trend}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ChartCard>

        {/* 复查率统计 */}
        <ChartCard title="复查率统计（按检查类型）">
          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
            {reexaminationData.map((item, i) => (
              <div key={item.type} style={{ padding: '10px 0', borderBottom: `1px solid ${C.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{item.type}</span>
                  <span style={{
                    padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600,
                    background: item.reexamRate >= 10 ? C.dangerBg : item.reexamRate >= 5 ? C.warningBg : C.successBg,
                    color: item.reexamRate >= 10 ? C.danger : item.reexamRate >= 5 ? C.warning : C.success
                  }}>
                    复查率 {item.reexamRate}%
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <div style={{ flex: 1, height: 6, background: C.background, borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{
                      width: `${item.reexamRate * 5}%`,
                      height: '100%',
                      background: item.reexamRate >= 10 ? C.danger : item.reexamRate >= 5 ? C.warning : C.success,
                      borderRadius: 3
                    }} />
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: C.textMuted }}>平均间隔 {item.avgDays} 天</span>
                  <span style={{ fontSize: 12, color: C.textMuted }}>原因: {item.reason}</span>
                </div>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>

      {/* 各设备阳性率与复查率对比 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <ChartCard title="各设备阳性率分布">
          <ChartContainer height={240} state={positiveRateData.length === 0 ? 'empty' : 'ready'} emptyDescription="暂无阳性率数据">
            <StatBarChart data={positiveRateData}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="modality" tick={{ fontSize: 12, fill: C.textMuted }} />
              <YAxis tick={{ fontSize: 12, fill: C.textMuted }} domain={[0, 100]} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: `1px solid ${C.border}` }} />
              <Bar dataKey="rate" name="阳性率%" radius={[4, 4, 0, 0]}>
                {positiveRateData.map((entry, i) => (
                  <Cell key={i} fill={entry.rate >= 50 ? C.danger : entry.rate >= 30 ? C.warning : C.success} />
                ))}
              </Bar>
            </StatBarChart>
          </ChartContainer>
        </ChartCard>

        <ChartCard title="阳性率7天趋势">
          <ChartContainer height={240} state={positiveTrendData.length === 0 ? 'empty' : 'ready'} emptyDescription="暂无阳性趋势数据">
            <LineChart data={positiveTrendData}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="day" tick={{ fontSize: 12, fill: C.textMuted }} />
              <YAxis tick={{ fontSize: 12, fill: C.textMuted }} domain={[30, 50]} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: `1px solid ${C.border}` }} />
              <Line type="monotone" dataKey="rate" stroke="#059669" strokeWidth={2} dot={{ r: 4 }} name="阳性率%" />
            </LineChart>
          </ChartContainer>
        </ChartCard>
      </div>
    </div>
  )
}

// ============================================================
// 标签页：经营分析（收入、成本、效益、人均产出）
// ============================================================
function BusinessAnalysisTab() {
  const { t } = useTranslation('v3stats')
  const [timeRange, setTimeRange] = useState('month')

  const timeRanges = [
    { key: 'month', label: '本月' },
    { key: 'quarter', label: '本季度' },
    { key: 'year', label: '本年' },
  ]

  const profitMargin = ((businessStats.netProfit / businessStats.totalRevenue) * 100).toFixed(1)

  return (
    <div>
      {/* 筛选栏 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Calendar size={14} color={C.textMuted} />
          <div style={{ display: 'flex', gap: 4, background: C.background, borderRadius: 8, padding: 4 }}>
            {timeRanges.map(r => (
              <button key={r.key} onClick={() => setTimeRange(r.key)} style={{
                padding: '5px 12px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600,
                cursor: 'pointer', background: timeRange === r.key ? C.white : 'transparent',
                color: timeRange === r.key ? C.primary : C.textMuted,
                boxShadow: timeRange === r.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
              }}>{r.label}</button>
            ))}
          </div>
        </div>
        <button onClick={handleExportBusinessReport} style={{
          padding: '6px 14px', background: C.white, color: C.textMuted,
          border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 12, fontWeight: 600,
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
        }}>
          <Download size={13} /> {t('statistics.exportBusinessReport')}
        </button>
      </div>

      {/* 经营概览卡片 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 20 }}>
        <StatCard label="总收入" value={`¥${(businessStats.totalRevenue / 10000).toFixed(0)}万`}
          subValue="本月累计" icon={<DollarSign size={20} />} color={C.success} bg={C.successBg}
          trend={{ value: businessStats.yoyRevenue, up: true }} />
        <StatCard label="总成本" value={`¥${(businessStats.totalCost / 10000).toFixed(0)}万`}
          subValue="成本率 53%" icon={<BarChart3 size={20} />} color={C.warning} bg={C.warningBg}
          trend={{ value: '+8.2%', up: false }} />
        <StatCard label="净利润" value={`¥${(businessStats.netProfit / 10000).toFixed(0)}万`}
          subValue={`利润率 ${profitMargin}%`} icon={<TrendingUp size={20} />} color={C.info} bg={C.infoBg}
          trend={{ value: businessStats.yoyProfit, up: true }} />
        <StatCard label="人均产出" value={`¥${(businessStats.perCapitaRevenue / 10000).toFixed(1)}万`}
          subValue="人均利润 ¥8.75万" icon={<Award size={20} />} color={C.purple} bg={C.purpleBg}
          trend={{ value: '+12.3%', up: true }} />
      </div>

      {/* 月度利润趋势（面积图） */}
      <div style={{ marginBottom: 16 }}>
        <ChartCard title="月度收入、成本、利润趋势（万元）">
          <ChartContainer height={280} state={monthlyProfitData.length === 0 ? 'empty' : 'ready'} emptyDescription="暂无月度利润数据">
            <AreaChart data={monthlyProfitData}>
              <defs>
                <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#059669" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#dc2626" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#dc2626" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: C.textMuted }} />
              <YAxis tick={{ fontSize: 12, fill: C.textMuted }} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: `1px solid ${C.border}` }} />
              <Legend iconSize={10} verticalAlign="bottom" align="center" />
              <Area type="monotone" dataKey="revenue" stroke="#059669" strokeWidth={2} fill="url(#revenueGrad)" name="收入" />
              <Area type="monotone" dataKey="cost" stroke="#dc2626" strokeWidth={2} fill="url(#costGrad)" name="成本" />
              <Line type="monotone" dataKey="profit" stroke="#2563eb" strokeWidth={2} dot={{ r: 4 }} name="利润" />
            </AreaChart>
          </ChartContainer>
        </ChartCard>
      </div>

      {/* 成本结构与人均产出 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* 成本结构饼图 */}
        <ChartCard title="成本结构分析">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 150, height: 150, flexShrink: 0 }}>
            <ChartContainer height={150} state={costBreakdown.length === 0 ? 'empty' : 'ready'} emptyDescription="暂无成本构成数据">
              <StatPieChart>
                <Pie data={costBreakdown} cx="50%" cy="50%" innerRadius={42} outerRadius={65} paddingAngle={2} dataKey="value">
                  {costBreakdown.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} formatter={(v: number) => `¥${(v / 10000).toFixed(0)}万`} />
              </StatPieChart>
            </ChartContainer>
            </div>
            <div style={{ flex: 1 }}>
              {costBreakdown.map(item => (
                <div key={item.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0', borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.color }} />
                    <span style={{ fontSize: 12, color: C.text }}>{item.name}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: C.primary }}>¥{(item.value / 10000).toFixed(0)}万</span>
                    <span style={{ fontSize: 12, color: C.textMuted, marginLeft: 4 }}>({item.percent}%)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </ChartCard>

        {/* 人均产出趋势 */}
        <ChartCard title="人均产出趋势（万元）">
          <ChartContainer height={220} state={perCapitaTrend.length === 0 ? 'empty' : 'ready'} emptyDescription="暂无人均费用数据">
            <LineChart data={perCapitaTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: C.textMuted }} />
              <YAxis tick={{ fontSize: 12, fill: C.textMuted }} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: `1px solid ${C.border}` }}
                formatter={(value: number) => `¥${(value / 10000).toFixed(1)}万`} />
              <Legend iconSize={10} verticalAlign="bottom" align="center" />
              <Line type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} name="人均收入" />
              <Line type="monotone" dataKey="profit" stroke="#059669" strokeWidth={2} dot={{ r: 3 }} name="人均利润" />
            </LineChart>
          </ChartContainer>
        </ChartCard>
      </div>

      {/* 科室效益排名表 */}
      <ChartCard title="各科室效益分析">
        <div style={{ overflowX: "auto" }}><table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: C.background }}>
              {['科室', '收入(万)', '成本(万)', '利润(万)', '人数', '人均利润(万)', '利润率'].map(h => (
                <th key={h} style={{ padding: '10px 12px', fontSize: 12, fontWeight: 700, color: C.textMuted, textAlign: 'center', borderBottom: `1px solid ${C.border}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {efficiencyMetrics.map(dept => {
              const rate = ((dept.profit / dept.revenue) * 100).toFixed(1)
              return (
                <tr key={dept.dept} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: '12px 12px', fontSize: 12, fontWeight: 600, color: C.primary, textAlign: 'center' }}>{dept.dept}</td>
                  <td style={{ padding: '12px 12px', fontSize: 12, textAlign: 'center', color: C.success }}>{(dept.revenue / 10000).toFixed(0)}</td>
                  <td style={{ padding: '12px 12px', fontSize: 12, textAlign: 'center', color: C.danger }}>{(dept.cost / 10000).toFixed(0)}</td>
                  <td style={{ padding: '12px 12px', fontSize: 12, textAlign: 'center', fontWeight: 700, color: C.info }}>{(dept.profit / 10000).toFixed(0)}</td>
                  <td style={{ padding: '12px 12px', fontSize: 12, textAlign: 'center' }}>{dept.staff}</td>
                  <td style={{ padding: '12px 12px', fontSize: 12, textAlign: 'center', fontWeight: 700, color: C.primary }}>{(dept.perCapita / 10000).toFixed(1)}</td>
                  <td style={{ padding: '12px 12px', fontSize: 12, textAlign: 'center' }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600,
                      background: parseFloat(rate) >= 45 ? C.successBg : parseFloat(rate) >= 35 ? C.warningBg : C.dangerBg,
                      color: parseFloat(rate) >= 45 ? C.success : parseFloat(rate) >= 35 ? C.warning : C.danger
                    }}>{rate}%</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table></div>
      </ChartCard>
    </div>
  )
}

// ============================================================
// 主组件
// ============================================================
export default function StatisticsPage() {
  const { t } = useTranslation('v3stats')
  const [activeTab, setActiveTab] = useState('examVolume')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      const res = await statsApi.getQuality()
      if (cancelled) return
      if (res.success && res.data) {
        setLoadError(null)
      } else {
        setLoadError(t('statistics.apiError'))
      }
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [refreshKey, t])

  // Toast消息状态
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  // 导出进度Modal状态
  const [exportModal, setExportModal] = useState<{ visible: boolean; text: string }>({ visible: false, text: '' })

  // 显示Toast
  const showToast = (text: string, type: 'success' | 'error') => {
    setToast({ text, type })
    setTimeout(() => setToast(null), 3000)
  }

  // 刷新数据处理
  const handleRefresh = () => {
    showToast(t('statistics.refreshing'), 'success')
    setRefreshKey((k) => k + 1)
  }

  // 导出CSV工具
  const downloadCsv = (filename: string, sections: Array<{ title: string; rows: (string | number)[][] }>) => {
    const lines: string[] = []
    sections.forEach((s) => {
      lines.push(`### ${s.title}`)
      s.rows.forEach((r) => lines.push(r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')))
      lines.push('')
    })
    const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // 导出报表处理（真实CSV：当前页统计卡/趋势/分布数据）
  const handleExportReport = () => {
    setExportModal({ visible: true, text: t('statistics.exporting') })
    setTimeout(() => {
      try {
        downloadCsv('放射科统计报表.csv', [
          {
            title: '检查量趋势(近7天)',
            rows: [['日期', '检查量', '报告量', '危急值'], ...sevenDayData.map((d) => [d.day, d.exams, d.reports, d.critical])],
          },
          {
            title: '时段分布',
            rows: [['时段', '检查量'], ...timeSlotData.map((d) => [d.slot, d.exams])],
          },
          {
            title: '检查部位分布(TOP10)',
            rows: [['部位', '数量'], ...bodyPartData.map((d) => [d.part, d.count])],
          },
          {
            title: '患者类型分布',
            rows: [['类型', '占比(%)'], ...patientTypeData.map((d) => [d.name, d.value])],
          },
          {
            title: '各模态阳性率',
            rows: [['模态', '阳性率(%)'], ...positiveRateData.map((d) => [d.modality, d.rate])],
          },
          {
            title: '阳性率排名(TOP8)',
            rows: [['排名', '检查类型', '阳性率(%)', '估算量', '趋势'], ...positiveRateRanking.map((d) => [d.rank, d.type, d.rate, d.count, d.trend])],
          },
          {
            title: '医生工作量TOP7',
            rows: [['医生', '报告量', '复核量', '平均耗时(min)', '危急值'], ...doctorWorkloadData.map((d) => [d.name, d.written, d.reviewed, d.avgTime, d.critical])],
          },
          {
            title: '质控评分趋势(近7天)',
            rows: [['日期', '均分'], ...qualityScoreData.map((d) => [d.day, d.score])],
          },
          {
            title: '质控等级分布',
            rows: [['等级', '占比(%)'], ...qualityDistribution.map((d) => [d.name, d.value])],
          },
          {
            title: '设备效率',
            rows: [['设备', '日检查量', '平均耗时(min)', '利用率(%)', '故障数', '状态'], ...deviceEfficiencyData.map((d) => [d.name, d.exams, d.avgTime, d.utilization, d.faults, d.status])],
          },
        ])
        showToast(t('statistics.exportSuccess'), 'success')
      } catch {
        showToast(t('statistics.apiError'), 'error')
      } finally {
        setExportModal({ visible: false, text: '' })
      }
    }, 400)
  }

  // 导出经营报表处理（真实CSV：经营总览/成本/月度收支/科室效益）
  const handleExportBusinessReport = () => {
    setExportModal({ visible: true, text: t('statistics.exportingBusiness') })
    setTimeout(() => {
      try {
        downloadCsv('放射科经营报表.csv', [
          {
            title: '经营总览',
            rows: [
              ['指标', '数值'],
              ['总收入(元)', businessStats.totalRevenue],
              ['总成本(元)', businessStats.totalCost],
              ['净利润(元)', businessStats.netProfit],
              ['利润率(%)', businessStats.profitRate],
              ['人均收入(元)', businessStats.perCapitaRevenue],
              ['人均利润(元)', businessStats.perCapitaProfit],
              ['成本率(%)', businessStats.costRate],
              ['收入同比', businessStats.yoyRevenue],
              ['利润同比', businessStats.yoyProfit],
            ],
          },
          {
            title: '成本构成',
            rows: [['项目', '金额(元)', '占比(%)'], ...costBreakdown.map((d) => [d.name, d.value, d.percent])],
          },
          {
            title: '月度收支(万元)',
            rows: [['月份', '收入', '成本', '利润'], ...monthlyProfitData.map((d) => [d.month, d.revenue, d.cost, d.profit])],
          },
          {
            title: '人均产出趋势(万元)',
            rows: [['月份', '人均收入', '人均利润'], ...perCapitaTrend.map((d) => [d.month, d.revenue / 10000, d.profit / 10000])],
          },
          {
            title: '科室效益',
            rows: [['科室', '收入(元)', '成本(元)', '利润(元)', '人数', '人均利润(元)', '利润率(%)'], ...efficiencyMetrics.map((dept) => [dept.dept, dept.revenue, dept.cost, dept.profit, dept.staff, dept.perCapita, ((dept.profit / dept.revenue) * 100).toFixed(1)])],
          },
        ])
        showToast(t('statistics.exportBusinessSuccess'), 'success')
      } catch {
        showToast(t('statistics.apiError'), 'error')
      } finally {
        setExportModal({ visible: false, text: '' })
      }
    }, 400)
  }

  // 导出JSON（当前统计数据全量 → Blob 下载）
  const handleExportJson = () => {
    setExportModal({ visible: true, text: t('statistics.exporting') })
    setTimeout(() => {
      try {
        const payload = {
          exportedAt: new Date().toISOString(),
          kpi: {
            totalExams7d: sevenDayData.reduce((s, d) => s + d.exams, 0),
            totalReports7d: sevenDayData.reduce((s, d) => s + d.reports, 0),
            totalCritical7d: sevenDayData.reduce((s, d) => s + d.critical, 0),
            ...businessStats,
          },
          sevenDayTrend: sevenDayData,
          timeSlot: timeSlotData,
          bodyPart: bodyPartData,
          patientType: patientTypeData,
          positiveRate: positiveRateData,
          positiveRateRanking: positiveRateRanking,
          doctorWorkload: doctorWorkloadData,
          doctorTrend: doctorTrendData,
          qualityScoreTrend: qualityScoreData,
          qualityDistribution: qualityDistribution,
          deviceEfficiency: deviceEfficiencyData,
          business: {
            overview: businessStats,
            costBreakdown,
            monthlyProfit: monthlyProfitData,
            perCapitaTrend,
            department: efficiencyMetrics,
          },
        }
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = '放射科统计数据.json'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        showToast(t('statistics.exportSuccess'), 'success')
      } catch {
        showToast(t('statistics.apiError'), 'error')
      } finally {
        setExportModal({ visible: false, text: '' })
      }
    }, 400)
  }

  const tabs = [
    { key: 'examVolume', label: t('statistics.tabs.examVolume'), icon: <BarChart3 size={14} /> },
    { key: 'positiveRate', label: t('statistics.tabs.positiveRate'), icon: <ShieldCheck size={14} /> },
    { key: 'workload', label: t('statistics.tabs.workload'), icon: <Users size={14} /> },
    { key: 'business', label: t('statistics.tabs.business'), icon: <DollarSign size={14} /> },
    { key: 'revenue', label: t('statistics.tabs.revenue'), icon: <TrendingUp size={14} /> },
    { key: 'quality', label: t('statistics.tabs.quality'), icon: <Award size={14} /> },
    { key: 'device', label: t('statistics.tabs.device'), icon: <Monitor size={14} /> },
    { key: 'patient', label: t('statistics.tabs.patient'), icon: <UserCheck size={14} /> },
  ]

  return (
    <PageContainer background="default" maxWidth="wide" data-testid="statistics-page" style={{ padding: 0 }}>
      <PageHeader
        icon={<BarChart3 size={20} />}
        title="统计分析"
        subtitle="多维度数据图表 · 阳性率统计 · 业务报表"
        actions={
          <ExportButton data={() => buildStatisticsExportRows()} filename="统计报表" label="导出报表" ariaLabel="导出统计报表" />
        }
      />
      <StickyActionBar
        actions={[
          { key: 'refresh', label: '刷新数据', onClick: () => setLoading(true), type: 'default', ariaLabel: '刷新统计数据' },
          { key: 'export-csv', label: '导出CSV', onClick: handleExportReport, type: 'default', ariaLabel: '导出CSV' },
          { key: 'export-json', label: '导出JSON', onClick: handleExportJson, type: 'default', ariaLabel: '导出JSON' },
        ]}
        theme="light"
      />
      <div style={{ padding: '0 24px 24px' }}>
        <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto', background: C.background }}>
      {loading && <LoadingBanner message={t('statistics.loading')} />}
      {loadError && !loading && <ErrorBanner message={loadError} />}
      {/* Toast消息提示 */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '10px 20px',
          borderRadius: 6,
          background: toast.type === 'success' ? C.success : C.danger,
          color: C.white,
          fontSize: 14,
          zIndex: 1000,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}>
          {toast.text}
        </div>
      )}

      {/* 导出进度Modal */}
      {exportModal.visible && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999,
        }}>
          <Card bordered={false} style={{
            background: C.white,
            borderRadius: 12,
            padding: '30px 40px',
            textAlign: 'center',
            boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
          }} styles={{ body: { padding: 0 } }}>
            <div style={{
              width: 40,
              height: 40,
              border: `3px solid ${C.border}`,
              borderTopColor: C.primary,
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 16px',
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <div style={{ fontSize: 14, color: C.text, fontWeight: 600 }}>{exportModal.text}</div>
          </Card>
        </div>
      )}

      {/* 页面标题 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
    <div>
      <PageHeader
        variant="flex"
        title={t('statistics.title')}
        subtitle={t('statistics.subtitle')}
        style={{ marginBottom: 0 }}
      />
    </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleRefresh} style={{
            padding: '7px 14px', background: C.white, color: C.textMuted,
            border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 12, fontWeight: 600,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
          }}>
            <RefreshCw size={13} /> {t('statistics.refresh')}
          </button>
          <button onClick={handleExportReport} style={{
            padding: '7px 14px', background: C.primary, color: C.white,
            border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
          }}>
            <Download size={13} /> {t('statistics.exportReport')}
          </button>
        </div>
      </div>

      {/* 标签切换 */}
      <Card bordered={false} style={{ background: C.white, borderRadius: 12, padding: '12px 16px', marginBottom: 20, border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))' }} styles={{ body: { padding: 0 } }}>
        <div style={{ display: 'flex', gap: 4, overflowX: 'auto' }}>
          {tabs.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
              padding: '8px 16px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
              transition: 'all 0.2s',
              background: activeTab === tab.key ? C.infoBg : 'transparent',
              color: activeTab === tab.key ? C.info : C.textMuted
            }}>
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </Card>

      {/* 标签内容 */}
      {/* v3.0.6.8-23c (A8-P0-3): overflow:hidden 避免内嵌滚动条顶出圆角阴影 */}
      <div style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto', overflowY: 'visible' }}>
        {activeTab === 'examVolume' && <ExamVolumeTab />}
        {activeTab === 'positiveRate' && <PositiveRateTab />}
        {activeTab === 'workload' && <WorkloadTab />}
        {activeTab === 'business' && <BusinessAnalysisTab />}
        {activeTab === 'revenue' && <RevenueTab />}
        {activeTab === 'quality' && <QualityControlTab />}
        {activeTab === 'device' && <DeviceEfficiencyTab />}
        {activeTab === 'patient' && <PatientAnalysisTab />}
        </div>
      </div>
      </div>
      </div>
    </PageContainer>
  )
}
