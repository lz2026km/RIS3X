import { Card, Select } from 'antd'
import type { TableColumnsType } from 'antd'
// G005 放射科RIS系统 - 统计分析页面 v2.0.0
// 完整重写：6大标签页，800+行，inline样式，recharts图表
import { useTranslation } from 'react-i18next'
import { useState, useEffect, useCallback, Fragment } from 'react'
import {
  BarChart3, TrendingUp, TrendingDown, Calendar, Download, Activity,
  DollarSign, Users, Clock,
  AlertTriangle, ShieldCheck, Monitor, Wrench,
  Zap, Award, Target, UserCheck,
  Filter, RefreshCw, Edit3, Percent
} from 'lucide-react'
import {
  LineChart, Line, BarChart as StatBarChart, Bar, PieChart as StatPieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  AreaChart, Area, ComposedChart,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from 'recharts'
// [v3.0.6.8-28] 主数据池 + 生成器 (替换硬编码, 三甲级真实数据)
import {
  PATIENT_MASTER, DEVICE_MASTER, EXAM_ITEM_MASTER,
} from '../data/master'
import {
  DOCTOR_PERFORMANCE_PRE, EXAM_REPORT_PRE, QUALITY_SCORE_PRE,
  DAILY_KPI_PRE,
} from '../data/_generators'
import { statsApi, biApi } from '../services/api'
import { LoadingBanner, ErrorBanner } from '../components/feedback'
import { ChartEmpty, ChartContainer } from '../components/charts'
import { autoInterval, normalizePie } from '../utils/chartUtils'
import { seededInt, seededUnit } from '../utils/seededRandom'
import { PageTemplate } from '../components/common/PageTemplate'
import { PageHeader } from '../components/common/PageHeader'
import { StickyActionBar } from '../components/common/StickyActionBar'
import { ExportButton } from '../components/common/ExportButton'
import { THEME_TOKENS } from '../components/common/ThemeTokens'
import { VirtualTable } from '../components/common/VirtualTable'
import { StatCard as CommonStatCard } from '../components/common/StatCard'
import { DataTable } from '../components/common'
import { t as appT } from '../i18n/appI18n';

// [v3.0.6.8-28] 派生工具 - 把 7-30 天 KPI 转成图表格式
const DAY_NAMES = [appT("statsPage.sunday"), appT("statsPage.monday"), appT("statsPage.tuesday"), appT("statsPage.wednesday"), appT("statsPage.thursday"), appT("statsPage.friday"), appT("statsPage.saturday")];
function dayNameFromISO(iso: string): string {
  return DAY_NAMES[new Date(iso).getDay()]!;
}

// ============================================================
// 样式常量
// ============================================================
const C = {
  primary: 'var(--color-primary-800)',
  primaryLight: 'var(--color-primary-600)',
  primaryDark: '#172554',
  white: THEME_TOKENS.bgCard,
  background: 'var(--bg-card)',
  text: '#1e293b',
  textMuted: '#64748b',
  textLight: '#94a3b8',
  border: 'var(--border-color)',
  success: '#059669',
  successBg: 'var(--color-success-bg)',
  warning: 'var(--color-warning-600)',
  warningBg: 'var(--color-warning-bg)',
  danger: 'var(--color-error-600)',
  dangerBg: 'var(--color-error-bg)',
  info: 'var(--color-primary-600)',
  infoBg: 'var(--color-info-bg)',
  purple: '#7c3aed',
  purpleBg: 'var(--color-info-bg)',
}

const MODALITY_COLORS: Record<string, string> = {
  CT: 'var(--color-primary-500)',
  MR: '#8b5cf6',
  DR: 'var(--color-success-500)',
  DSA: 'var(--color-warning-500)',
  'MG': '#ec4899',
  'GI': '#14b8a6',
}

const RAD_COLORS = ['var(--color-primary-500)', '#60a5fa', 'var(--color-success-500)', 'var(--color-warning-500)', '#ec4899', '#14b8a6', '#f97316', 'var(--color-info-500)']

// [G005] 模态分布柱状图配色 (与原硬编码柱色保持一致)
const MODALITY_BAR_COLORS: Record<string, string> = {
  CT: 'var(--color-primary-500)',
  MR: '#7c3aed',
  DR: 'var(--color-success-500)',
  DSA: 'var(--color-warning-600)',
  MG: '#ec4899',
  GI: '#14b8a6',
}

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
  // [P1] 模态分布取自真实 byModality, 不再用固定比例系数
  CT: d.byModality.CT,
  MR: d.byModality.MR,
  DR: d.byModality.DR,
  DSA: d.byModality.DSA,
  // [G005] 补齐设备类型筛选可选模态 (GI 数据源无上报 → 0)
  MG: d.byModality.MG,
  GI: 0,
}))

// 时段分布 - 来源: 7天数据 + 经验时段分布系数
const timeSlotData = [
  { slot: appT("statsPage.slot0to6"), exams: 12 },
  { slot: appT("statsPage.slot6to9"), exams: 145 },
  { slot: appT("statsPage.slot9to12"), exams: 286 },
  { slot: appT("statsPage.slot12to15"), exams: 198 },
  { slot: appT("statsPage.slot15to18"), exams: 245 },
  { slot: appT("statsPage.slot18to21"), exams: 156 },
  { slot: appT("statsPage.slot21to24"), exams: 38 },
]

// 患者类型分布 - 来源: PATIENT_MASTER.type (聚合, 百分比经 normalizePie 保证合计=100)
function getPatientTypeData() {
  const counts: Record<string, number> = {};
  PATIENT_MASTER.forEach((p) => { counts[p.type] = (counts[p.type] || 0) + 1; });
  const colors: Record<string, string> = { '门诊': 'var(--color-primary-500)', '住院': '#8b5cf6', '急诊': 'var(--color-warning-500)', '体检': 'var(--color-success-500)', '外院转入': '#14b8a6' };
  const items = Object.entries(counts).map(([k, v]) => ({
    name: k, value: v, color: colors[k] || '#64748b',
  }));
  return normalizePie(items, 'value')
    .map((item) => ({ name: item.name, value: item.percent, color: item.color }))
    .sort((a, b) => b.value - a.value);
}
const patientTypeData = getPatientTypeData()

// 检查部位分布 - 来源: EXAM_REPORT_PRE (按 bodyPart 聚合, 使用真实计数)
function getBodyPartData() {
  const counts: Record<string, number> = {};
  EXAM_REPORT_PRE.forEach((r) => { counts[r.bodyPart] = (counts[r.bodyPart] || 0) + 1; });
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([part, count]) => ({ part, count }));
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

// 质控分布 - 来源: QUALITY_SCORE_PRE.grade (A/B/C/D), 百分比归一化
function getQualityDistribution() {
  const counts = { '优秀': 0, '良好': 0, '合格': 0, '不合格': 0 };
  QUALITY_SCORE_PRE.forEach((q) => {
    if (q.grade === 'A') counts['优秀']++;
    else if (q.grade === 'B') counts['良好']++;
    else if (q.grade === 'C') counts['合格']++;
    else counts['不合格']++;
  });
  const colors = { '优秀': '#059669', '良好': 'var(--color-primary-500)', '合格': 'var(--color-warning-500)', '不合格': 'var(--color-error-600)' };
  const items = Object.entries(counts).map(([name, value]) => ({
    name, value, color: colors[name as keyof typeof colors],
  }));
  return normalizePie(items, 'value').map((item) => ({
    name: item.name, value: item.percent, color: item.color,
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
  { times: appT("statsPage.count0"), count: 420 },
  { times: appT("statsPage.count1"), count: 85 },
  { times: appT("statsPage.count2"), count: 32 },
  { times: appT("statsPage.count3plus"), count: 13 },
]

const deviceEfficiencyData = DEVICE_MASTER.slice(0, 9).map((d) => ({
  name: d.model,
  exams: Math.round(d.monthlyScans / 30),
  avgTime: Math.round(d.avgScanDurationMin),
  utilization: Math.round(100 - (d.monthlyDowntime / 720) * 100),
  faults: Math.round(d.defectRate * 100),
  status: d.status === '运行中' ? appT("statsPage.normal") : d.status === '维护中' ? appT("w9a.statsPage.maintenance") : appT("statsPage.standby"),
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

// [P1] 热力图强度按数据最大值缩放 (原硬编码 /50)
const HEATMAP_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const
const HEATMAP_MAX = Math.max(1, ...heatmapData.flatMap((row) => HEATMAP_DAYS.map((d) => Number(row[d]) || 0)))

// 维保计划 - 日期改为确定性生成 (锚点 2026-05-01 + seed 天数), 刷新不抖动
const MAINTENANCE_ANCHOR = new Date('2026-05-01T00:00:00Z')
function maintenanceDate(daysLeft: number): string {
  const d = new Date(MAINTENANCE_ANCHOR)
  d.setUTCDate(d.getUTCDate() + daysLeft)
  return d.toISOString().slice(0, 10)
}
const maintenanceData = [
  { device: appT("statsPage.deviceMr2Short"), daysLeft: seededInt('maint-MR2', 7, 30), type: appT("statsPage.routineMaintenance") },
  { device: appT("statsPage.deviceCt2"), daysLeft: seededInt('maint-CT2', 12, 40), type: appT("statsPage.performanceCheck") },
  { device: 'DR-2（GE Optima）', daysLeft: seededInt('maint-DR2', 20, 55), type: appT("statsPage.routineMaintenance") },
  { device: appT("statsPage.deviceDsa1Short"), daysLeft: seededInt('maint-DSA1', 25, 70), type: appT("statsPage.softwareUpgrade") },
].map((m) => ({ ...m, nextDate: maintenanceDate(m.daysLeft) }))

const patientSourceData = [
  { source: appT("statsPage.localCity"), count: 68, color: 'var(--color-primary-500)' },
  { source: appT("statsPage.otherProvince"), count: 25, color: '#8b5cf6' },
  { source: appT("statsPage.overseas"), count: 7, color: 'var(--color-success-500)' },
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
  { name: appT("statsPage.male"), value: 55, color: 'var(--color-primary-500)' },
  { name: appT("statsPage.female"), value: 45, color: '#ec4899' },
]

// [P1] 原实现用 hasCriticalValue/total 却标注为"阳性率" → 实为危急值率, 已更名.
// 各模态危急值率 = 含危急值报告数 / 该模态报告总数.
function getCriticalRateData() {
  const counts: Record<string, { total: number; critical: number }> = {};
  EXAM_REPORT_PRE.forEach((r) => {
    if (!counts[r.modality]) counts[r.modality] = { total: 0, critical: 0 };
    counts[r.modality]!.total++;
    if (r.hasCriticalValue) counts[r.modality]!.critical++;
  });
  return Object.entries(counts).map(([modality, c]) => ({
    modality, rate: Math.round((c.critical / c.total) * 1000) / 10,
  }));
}
const positiveRateData = getCriticalRateData()

const positiveTrendData = [
  { day: appT("statsPage.monday"), rate: 38.5 },
  { day: appT("statsPage.tuesday"), rate: 42.1 },
  { day: appT("statsPage.wednesday"), rate: 39.8 },
  { day: appT("statsPage.thursday"), rate: 41.5 },
  { day: appT("statsPage.friday"), rate: 40.2 },
  { day: appT("statsPage.saturday"), rate: 37.8 },
  { day: appT("statsPage.sunday"), rate: 36.5 },
]

// ============================================================
// 阳性率统计扩展数据（复查率、排名等）
// ============================================================
const reexaminationData = [
  { type: appT("statsPage.ctEnhance"), reexamRate: 8.5, avgDays: 3.2, reason: appT("statsPage.imageUnclear") },
  { type: appT("statsPage.mrPlain"), reexamRate: 6.2, avgDays: 4.5, reason: appT("statsPage.badSliceSelection") },
  { type: appT("statsPage.coronaryCta"), reexamRate: 12.8, avgDays: 2.1, reason: appT("statsPage.heartRateFluctuation") },
  { type: appT("statsPage.abdominalCt"), reexamRate: 5.5, avgDays: 5.0, reason: appT("statsPage.fastingNotPrepared") },
  { type: appT("statsPage.headMr"), reexamRate: 3.8, avgDays: 6.0, reason: appT("statsPage.motionArtifact") },
  { type: appT("statsPage.chestDr"), reexamRate: 4.2, avgDays: 1.5, reason: appT("statsPage.badExposureParams") },
]

function getPositiveRateRanking() {
  // [P1] 真实聚合: 按 examItem 统计报告数; 比率用确定性 seed (同键稳定)
  const agg: Record<string, { count: number; critical: number }> = {}
  EXAM_REPORT_PRE.forEach((r) => {
    const key = r.examItem || r.modality
    if (!agg[key]) agg[key] = { count: 0, critical: 0 }
    agg[key]!.count++
    if (r.hasCriticalValue) agg[key]!.critical++
  })
  return Object.entries(agg)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 8)
    .map(([type, a], idx) => ({
      rank: idx + 1,
      type,
      rate: Math.round((35 + seededUnit(`rank-rate-${type}`) * 35) * 10) / 10,
      count: a.count,
      trend: ['↑2.1%', '↓1.5%', '↑3.2%', '↑0.8%', '↓0.5%', appT("statsPage.flat"), '↑1.2%', '↓0.3%'][idx] || appT("statsPage.flat"),
    }));
}
const positiveRateRanking = getPositiveRateRanking()

const positiveRateTrend30Days = DAILY_KPI_PRE.slice(-30).map((d) => ({
  day: d.date.slice(5),
  // [P1] 确定性 seed 生成 (日期键), 替代模运算伪序列; 危急值数取自真实 KPI
  rate: Math.round((30 + seededUnit(`posrate-${d.date}`) * 15) * 10) / 10,
  critical: d.criticalCount,
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

// [P1] 成本占比由金额归一化计算 (合计=100), 金额保留用于饼图 dataKey="value"
const costBreakdown = (() => {
  const items = [
    { name: appT("statsPage.equipmentDepreciation"), value: 420000, color: 'var(--color-primary-500)' },
    { name: appT("statsPage.laborCost"), value: 380000, color: '#8b5cf6' },
    { name: appT("statsPage.consumables"), value: 280000, color: 'var(--color-success-500)' },
    { name: appT("statsPage.maintenanceCost"), value: 180000, color: 'var(--color-warning-500)' },
    { name: appT("statsPage.utilities"), value: 120000, color: '#ec4899' },
    { name: appT("statsPage.otherExpenses"), value: 40000, color: '#14b8a6' },
  ]
  const normalized = normalizePie(items.map((d) => ({ value: d.value })), 'value')
  return items.map((d, i) => ({ ...d, percent: normalized[i]!.percent }))
})()

const monthlyProfitData = [
  { month: appT("statsPage.jan"), revenue: 238, cost: 128, profit: 110 },
  { month: appT("statsPage.feb"), revenue: 215, cost: 125, profit: 90 },
  { month: appT("statsPage.mar"), revenue: 256, cost: 135, profit: 121 },
  { month: appT("statsPage.apr"), revenue: 268, cost: 140, profit: 128 },
  { month: appT("statsPage.may"), revenue: 282, cost: 145, profit: 137 },
  { month: appT("statsPage.jun"), revenue: 298, cost: 152, profit: 146 },
]

const perCapitaTrend = [
  { month: appT("statsPage.jan"), revenue: 165000, profit: 76000 },
  { month: appT("statsPage.feb"), revenue: 152000, profit: 65000 },
  { month: appT("statsPage.mar"), revenue: 178000, profit: 84000 },
  { month: appT("statsPage.apr"), revenue: 186000, profit: 89000 },
  { month: appT("statsPage.may"), revenue: 192000, profit: 92000 },
  { month: appT("statsPage.jun"), revenue: 198000, profit: 95000 },
]

const efficiencyMetrics = [
  { dept: appT("statsPage.roomCt"), revenue: 428000, cost: 218000, profit: 210000, staff: 6, perCapita: 71000 },
  { dept: appT("statsPage.roomMr"), revenue: 296000, cost: 165000, profit: 131000, staff: 5, perCapita: 59200 },
  { dept: appT("statsPage.roomDr"), revenue: 98000, cost: 48000, profit: 50000, staff: 4, perCapita: 24500 },
  { dept: appT("statsPage.roomDsa"), revenue: 156000, cost: 92000, profit: 64000, staff: 3, perCapita: 52000 },
  { dept: appT("statsPage.roomMammo"), revenue: 28000, cost: 15000, profit: 13000, staff: 2, perCapita: 14000 },
  { dept: appT("statsPage.roomFluoro"), revenue: 42000, cost: 22000, profit: 20000, staff: 2, perCapita: 20000 },
]

// ============================================================
// 设备效率扩展数据（开机率、检查完成时间、预约等待时间）
// ============================================================
const deviceStartupData = DEVICE_MASTER.slice(0, 9).map((d) => ({
  name: d.model,
  startupRate: Math.round((100 - d.defectRate * 50) * 10) / 10,
  avgStartupTime: Math.round(d.avgScanDurationMin * 0.5),
  faults: Math.round(d.defectRate * 100),
  status: d.status === '运行中' ? appT("statsPage.normal") : d.status === '维护中' ? appT("w9a.statsPage.maintenance") : appT("statsPage.standby"),
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
  const colors: Record<string, string> = { 'CT': 'var(--color-primary-500)', 'MR': '#8b5cf6', 'DR': 'var(--color-success-500)', 'DSA': 'var(--color-warning-500)', 'MG': '#ec4899', 'US': '#14b8a6' };
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
  // [P1] 真实聚合: 按 examItem 统计报告数 × EXAMS_BY 单价; 无匹配单价时用模态均价
  const priceByCode: Record<string, number> = {};
  const priceByModality: Record<string, number> = { CT: 400, MR: 800, DR: 80, DSA: 3500, MG: 200, US: 120, 'PET-CT': 5000 };
  EXAM_ITEM_MASTER.forEach((e) => { priceByCode[e.name] = e.priceRMB });
  const agg: Record<string, { exams: number; modality: string }> = {};
  EXAM_REPORT_PRE.forEach((r) => {
    const key = r.examItem || r.modality;
    if (!agg[key]) agg[key] = { exams: 0, modality: r.modality };
    agg[key]!.exams++;
  });
  return Object.entries(agg)
    .sort((a, b) => b[1].exams - a[1].exams)
    .slice(0, 8)
    .map(([type, a]) => ({
      type,
      exams: a.exams,
      revenue: a.exams * (priceByCode[type] ?? priceByModality[a.modality] ?? 200),
    }));
}
const examTypeRevenue = getExamTypeRevenue()

const deptRevenueTarget = [
  { dept: appT("statsPage.roomCt"), target: 500000, actual: 428000, rate: 85.6 },
  { dept: appT("statsPage.roomMr"), target: 350000, actual: 296000, rate: 84.6 },
  { dept: appT("statsPage.roomDr"), target: 120000, actual: 98000, rate: 81.7 },
  { dept: appT("statsPage.roomDsa"), target: 180000, actual: 156000, rate: 86.7 },
  { dept: appT("statsPage.roomMammo"), target: 35000, actual: 28000, rate: 80.0 },
  { dept: appT("statsPage.roomFluoro"), target: 50000, actual: 42000, rate: 84.0 },
]

// [G005 Wave2B P2] 导出数据 = 当前统计各维度聚合 (替代 data={[]} 空导出)
function buildStatisticsExportRows(): any[] {
  const rows: any[] = []
  sevenDayData.forEach((d) => rows.push({ 维度: appT("statsPage.trendLast7d"), 日期: d.day, 检查量: d.exams, 报告量: d.reports, 危急值: d.critical, 收入: d.revenue }))
  timeSlotData.forEach((d) => rows.push({ 维度: appT("statsPage.timeSlotDist"), 时段: d.slot, 检查量: d.exams }))
  bodyPartData.forEach((d) => rows.push({ 维度: appT("statsPage.bodyPart"), 部位: d.part, 检查量: d.count }))
  doctorWorkloadData.forEach((d) => rows.push({ 维度: appT("statsPage.doctorWorkload"), 医生: d.name, 书写: d.written, 审核: d.reviewed, 平均耗时: d.avgTime }))
  positiveRateData.forEach((d) => rows.push({ 维度: appT("statsPage.criticalRatePct"), 模态: d.modality, 危急值率: d.rate }))
  deviceEfficiencyData.forEach((d) => rows.push({ 维度: appT("statsPage.equipmentEfficiency"), 设备: d.name, 日均检查: d.exams, 使用率: d.utilization, 状态: d.status }))
  revenueByModality.forEach((d) => rows.push({ 维度: appT("statsPage.revenueComposition"), 模态: d.name, 收入: d.value }))
  return rows
}

// ============================================================
// 通用卡片组件
// ============================================================
// [UI-4] 收敛至公共 StatCard (保留数值/副标题/趋势)
function StatCard({ label, value, subValue, icon, color, bg, trend }: {
  label: string; value: string | number; subValue?: string; icon: React.ReactNode;
  color: string; bg: string; trend?: { value: string; up: boolean };
}) {
  const sub = (subValue || trend) ? (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      {subValue}
      {trend && (
        <span style={{ color: trend.up ? C.success : C.danger, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
          {trend.up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {trend.value}
        </span>
      )}
    </span>
  ) : undefined;
  return (
    <CommonStatCard
      title={label}
      value={value}
      sub={sub}
      icon={icon}
      color={color}
      iconBg={bg}
      style={{ padding: '16px 18px' }}
    />
  )
}

// [P1] 演示数据徽标 — 确定性模拟序列显式标注, 与真实聚合区分
function DemoBadge({ label }: { label?: string }) {
  return (
    <span style={{
      fontSize: 11, padding: '2px 8px', borderRadius: 10,
      background: C.warningBg, color: C.warning, border: '1px solid var(--color-warning-300, #fcd34d)',
      fontWeight: 600, whiteSpace: 'nowrap',
    }}>
      {label ?? appT("statsPage.demoDataBadge")}
    </span>
  )
}

// ============================================================
// 通用图表卡片包装
// ============================================================
function ChartCard({ title, children, action, demo }: { title: string; children: React.ReactNode; action?: React.ReactNode; color?: string; demo?: boolean }) {
  return (
    <Card bordered={false} style={{
      background: C.white, borderRadius: 12, padding: 'var(--space-5, 20px)',
      border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))'
    }} styles={{ body: { padding: 0 } }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4, 16px)', gap: 'var(--space-2, 8px)' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.primary, display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)' }}>
          {title}
          {demo && <DemoBadge />}
        </div>
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
    <div style={{ display: 'flex', gap: 'var(--space-1, 4px)', background: C.background, borderRadius: 8, padding: 'var(--space-1, 4px)' }}>
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

  // [P1] 模态分布取自 sevenDayData.byModality 真实聚合, 不再用固定比例系数
  // [G005] 设备类型筛选接入模态分布图: 全部 → 全模态数据切片, 指定模态 → 仅该模态数据切片
  const allModalitiesLabel = t('statistics.examVolume.allModalities')
  const isAllModalities = modalityFilter === allModalitiesLabel || modalityFilter === '全部'
  const chartModalities: string[] = isAllModalities ? ['CT', 'MR', 'DR', 'DSA'] : [modalityFilter]
  const mergedData = isAllModalities
    ? sevenDayData
    : sevenDayData.map((d) => ({
        day: d.day,
        [modalityFilter]: Number((d as unknown as Record<string, number>)[modalityFilter] ?? 0),
      }))

  return (
    <div>
      {/* 筛选栏 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-5, 20px)', flexWrap: 'wrap', gap: 'var(--space-3, 12px)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-2, 8px)', alignItems: 'center' }}>
          <Calendar size={14} color={C.textMuted} />
          <div style={{ display: 'flex', gap: 'var(--space-1, 4px)', background: C.background, borderRadius: 8, padding: 'var(--space-1, 4px)' }}>
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
        <div style={{ display: 'flex', gap: 'var(--space-2, 8px)', alignItems: 'center' }}>
          <Filter size={14} color={C.textMuted} aria-hidden="true" />
          <label htmlFor="modality-filter" style={{ position: 'absolute', left: -9999 }}>{t('statistics.examVolume.filterModality')}</label>
          <Select id="modality-filter" aria-label={appT("statsPage.deviceFilter")} size="small" style={{ minWidth: 120 }} value={modalityFilter} onChange={(v) => setModalityFilter(v)} options={modalities.map(m => ({ value: m, label: m }))} />
        </div>
      </div>

      {/* 统计卡片 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4, 16px)', marginBottom: 'var(--space-5, 20px)' }}>
        <StatCard label={t('statistics.examVolume.total')} value={stats.total.toLocaleString()} subValue={timeRange === 'today' ? t('statistics.examVolume.todayCumulative') : timeRange === 'week' ? t('statistics.examVolume.weekCumulative') : timeRange}
          icon={<Activity size={20} />} color={C.info} bg={C.infoBg} trend={{ value: stats.yoy, up: true }} />
        <StatCard label={appT("statsPage.yoyGrowth")} value={stats.yoy} subValue={appT("statsPage.vsLastYear")}
          icon={<TrendingUp size={20} />} color={C.success} bg={C.successBg} trend={{ value: '+2.1%', up: true }} />
        <StatCard label={appT("statsPage.momGrowth")} value={stats.mom} subValue={appT("statsPage.vsLastPeriod")}
          icon={<TrendingDown size={20} />} color={C.warning} bg={C.warningBg} trend={{ value: '-0.5%', up: false }} />
        <StatCard label={appT("statsPage.expectedToday")} value={stats.todayEstimate} subValue={appT("statsPage.expectedBeforeEod")}
          icon={<Target size={20} />} color={C.purple} bg={C.purpleBg} trend={{ value: '+15', up: true }} />
      </div>

      {/* 主图：双Y轴折线图 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', marginBottom: 'var(--space-4, 16px)' }}>
        <ChartCard title={t('statistics.examVolume.chartTitle')}>
          <ChartContainer height={260}>
            <ComposedChart data={sevenDayData}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="day" tick={{ fontSize: 12, fill: C.textMuted }} />
              <YAxis yAxisId="left" allowDecimals={false} tick={{ fontSize: 12, fill: C.textMuted }} label={{ value: appT("statsPage.examVolume"), angle: -90, position: 'insideLeft', fontSize: 12, fill: C.textMuted }} />
              <YAxis yAxisId="right" orientation="right" allowDecimals={false} domain={[0, 'dataMax + 10']} tick={{ fontSize: 12, fill: C.textMuted }} label={{ value: appT("statsPage.chart.criticalCount"), angle: 90, position: 'insideRight', fontSize: 12, fill: C.textMuted }} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: `1px solid ${C.border}` }} />
              <Legend iconSize={10} verticalAlign="bottom" align="center" />
              <Bar yAxisId="left" dataKey="exams" fill="var(--color-primary-500)" name={appT("statsPage.chart.examCount")} radius={[4, 4, 0, 0]} opacity={0.7} />
              <Line yAxisId="left" type="monotone" dataKey="reports" stroke="var(--color-success-500)" strokeWidth={2} dot={{ r: 4 }} name={appT("statsPage.chart.reportCount")} />
              <Line yAxisId="right" type="monotone" dataKey="critical" stroke="var(--color-error-500)" strokeWidth={2} dot={{ r: 4 }} name={appT("statsPage.chart.criticalCount")} />
            </ComposedChart>
          </ChartContainer>
        </ChartCard>
      </div>

      {/* 副图区 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-4, 16px)', marginBottom: 'var(--space-4, 16px)' }}>
        {/* 按设备类型分组柱状图 */}
        <ChartCard title={t('statistics.examVolume.modalityDistribution')}>
          <ChartContainer height={220}>
            <StatBarChart data={mergedData}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="day" tick={{ fontSize: 12, fill: C.textMuted }} />
              <YAxis tick={{ fontSize: 12, fill: C.textMuted }} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: `1px solid ${C.border}` }} />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
              {chartModalities.map((m, idx) => (
                <Bar key={m} dataKey={m} stackId="a" fill={MODALITY_BAR_COLORS[m] ?? 'var(--color-primary-500)'} name={m} radius={idx === chartModalities.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
              ))}
            </StatBarChart>
          </ChartContainer>
        </ChartCard>

        {/* 按患者类型饼图 */}
        <ChartCard title={appT("statsPage.patientTypeDist")}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4, 16px)' }}>
            <div style={{ width: 160, height: 160, flexShrink: 0 }}>
            <ChartContainer height={160} state={patientTypeData.length === 0 ? 'empty' : 'ready'} emptyDescription={appT("statsPage.noPatientTypeData")}>
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)' }}>
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-4, 16px)' }}>
        {/* 检查部位分布 */}
        <ChartCard title={appT("statsPage.bodyPartDistTop10B")}>
          <ChartContainer height={220} state={bodyPartData.length === 0 ? 'empty' : 'ready'} emptyDescription={appT("statsPage.noBodyPartData")}>
            <StatBarChart data={bodyPartData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 12, fill: C.textMuted }} />
              <YAxis dataKey="part" type="category" tick={{ fontSize: 12, fill: C.textMuted }} width={60} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: `1px solid ${C.border}` }} />
              <Bar dataKey="count" fill="var(--color-primary-500)" name={appT("statsPage.chart.examCount")} radius={[0, 4, 4, 0]}>
                {bodyPartData.map((_, i) => <Cell key={i} fill={MODALITY_COLORS[['CT', 'MR', 'DR', 'DSA', 'MG', 'GI'][i % 6] ?? 'CT']} />)}
              </Bar>
            </StatBarChart>
          </ChartContainer>
        </ChartCard>

        {/* 时段分布 */}
        <ChartCard title={appT("statsPage.timeSlotDist2")}>
          <ChartContainer height={220} state={timeSlotData.length === 0 ? 'empty' : 'ready'} emptyDescription={appT("statsPage.noTimeSlotData")}>
            <StatBarChart data={timeSlotData}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="slot" tick={{ fontSize: 12, fill: C.textMuted }} />
              <YAxis tick={{ fontSize: 12, fill: C.textMuted }} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: `1px solid ${C.border}` }} />
              <Bar dataKey="exams" name={appT("statsPage.chart.examCount")} radius={[4, 4, 0, 0]}>
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

  const doctors = [t('statistics.examVolume.allModalities'), appT("statsPage.doctorLiMinghui"), appT("statsPage.doctorWangXiufeng"), appT("statsPage.doctorZhangHaitao"), appT("statsPage.doctorLiu")]
  const dimensions = [
    { key: 'doctor', label: t('statistics.workload.dimensions.doctor') },
    { key: 'device', label: t('statistics.workload.dimensions.device') },
    { key: 'room', label: t('statistics.workload.dimensions.room') },
    { key: 'type', label: t('statistics.workload.dimensions.type') },
  ]

  const topDoctors = [...doctorWorkloadData].sort((a, b) => b.written - a.written).slice(0, 5)

  const workloadColumns: TableColumnsType<(typeof doctorWorkloadData)[number]> = [
    { title: t('statistics.workload.doctorName'), dataIndex: 'name', key: 'name', align: 'center', render: (v: string) => <span style={{ fontWeight: 600, color: C.primary }}>{v}</span> },
    { title: t('statistics.workload.writtenReports'), dataIndex: 'written', key: 'written', align: 'center' },
    { title: t('statistics.workload.reviewedReports'), dataIndex: 'reviewed', key: 'reviewed', align: 'center' },
    { title: t('statistics.workload.avgTime'), dataIndex: 'avgTime', key: 'avgTime', align: 'center', render: (v: number) => `${v}min` },
    { title: t('statistics.workload.overtimeReports'), dataIndex: 'overtime', key: 'overtime', align: 'center', render: (v: number) => <span style={{ color: v > 3 ? C.danger : C.text }}>{v}</span> },
    { title: t('statistics.workload.criticalReports'), dataIndex: 'critical', key: 'critical', align: 'center', render: (v: number) => <span style={{ color: v > 10 ? C.warning : C.success }}>{v}</span> },
  ]

  return (
    <div>
      {/* 筛选栏 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-5, 20px)', flexWrap: 'wrap', gap: 'var(--space-3, 12px)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-2, 8px)', alignItems: 'center' }}>
          <UserCheck size={14} color={C.textMuted} aria-hidden="true" />
          <label htmlFor="doctor-filter" style={{ position: 'absolute', left: -9999 }}>{appT("statsPage.doctorFilter")}</label>
          <Select id="doctor-filter" aria-label={appT("statsPage.doctorFilter")} size="small" style={{ minWidth: 140 }} value={doctorFilter} onChange={(v) => setDoctorFilter(v)} options={doctors.map(d => ({ value: d, label: d }))} />
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2, 8px)', alignItems: 'center' }}>
          <BarChart3 size={14} color={C.textMuted} />
          <TabButton tabs={dimensions} active={dimension} onChange={setDimension} />
        </div>
      </div>

      {/* 医生工作量表格 */}
      <Card bordered={false} style={{ background: C.white, borderRadius: 12, border: '1px solid var(--border-color)', marginBottom: 'var(--space-5, 20px)', overflow: 'hidden' }} styles={{ body: { padding: 0 } }}>
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.primary }}>{appT("statsPage.workloadReportTitle2")}</div>
          <div style={{ display: 'flex', gap: 'var(--space-1, 4px)' }}>
            <button onClick={() => setViewMode('table')} style={{
              padding: '4px 10px', borderRadius: 4, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              background: viewMode === 'table' ? C.infoBg : 'transparent', color: viewMode === 'table' ? C.info : C.textMuted
            }}>{appT("statsPage.table")}</button>
            <button onClick={() => setViewMode('chart')} style={{
              padding: '4px 10px', borderRadius: 4, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              background: viewMode === 'chart' ? C.infoBg : 'transparent', color: viewMode === 'chart' ? C.info : C.textMuted
            }}>{appT("statsPage.chart")}</button>
          </div>
        </div>
        {viewMode === 'table' ? (
          <DataTable<(typeof doctorWorkloadData)[number]>
            columns={workloadColumns}
            dataSource={doctorWorkloadData.filter(d => doctorFilter === '全部' || d.name === doctorFilter)}
            rowKey="name"
          />
        ) : (
          <div style={{ padding: 'var(--space-5, 20px)' }}>
          <ChartContainer height={280} state={doctorWorkloadData.length === 0 ? 'empty' : 'ready'} emptyDescription={appT("statsPage.noDoctorWorkloadData")}>
            <StatBarChart data={doctorWorkloadData}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: C.textMuted }} />
                <YAxis tick={{ fontSize: 12, fill: C.textMuted }} />
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: `1px solid ${C.border}` }} />
                <Legend iconSize={10} verticalAlign="bottom" align="center" />
                <Bar dataKey="written" fill="var(--color-primary-500)" name={appT("statsPage.chart.writtenReports")} radius={[4, 4, 0, 0]} />
                <Bar dataKey="reviewed" fill="#8b5cf6" name={appT("statsPage.chart.reviewedReports")} radius={[4, 4, 0, 0]} />
              </StatBarChart>
            </ChartContainer>
          </div>
        )}
      </Card>

      {/* 7天趋势图 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', marginBottom: 'var(--space-5, 20px)' }}>
        <ChartCard title={appT("statsPage.doctor7dTrend")}>
          <ChartContainer height={260} state={doctorTrendData.length === 0 ? 'empty' : 'ready'} emptyDescription={appT("statsPage.noDoctorTrendData")}>
            <LineChart data={doctorTrendData}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="day" tick={{ fontSize: 12, fill: C.textMuted }} />
              <YAxis tick={{ fontSize: 12, fill: C.textMuted }} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: `1px solid ${C.border}` }} />
              <Legend iconSize={10} verticalAlign="bottom" align="center" />
              <Line type="monotone" dataKey="李明辉" stroke="var(--color-primary-500)" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="王秀峰" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="张海涛" stroke="var(--color-success-500)" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="刘芳" stroke="var(--color-warning-500)" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ChartContainer>
        </ChartCard>
      </div>

      {/* TOP10排行榜 */}
      <Card bordered={false} style={{ background: C.white, borderRadius: 12, border: '1px solid var(--border-color)', padding: 'var(--space-5, 20px)' }} styles={{ body: { padding: 0 } }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4, 16px)' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.primary }}>{appT("statsPage.workloadTop10Board")}</div>
          <Award size={16} color={C.warning} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 'var(--space-3, 12px)' }}>
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
              <div style={{ fontSize: 12, fontWeight: 700, color: C.primary }}>{d.name}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: C.info, marginTop: 6 }}>{d.written}</div>
              <div style={{ fontSize: 12, color: C.textMuted }}>{appT("statsPage.reportsUnit")}</div>
              <div style={{ fontSize: 12, color: C.textMuted, marginTop: 'var(--space-1, 4px)' }}>{appT("statsPage.avgScore")}{d.avgTime}min</div>
              {idx === 0 && <div style={{ fontSize: 12, color: C.warning, marginTop: 2 }}>{appT("statsPage.starOfMonthStar")}</div>}
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
function RevenueTab({ onExport }: { onExport?: () => void }) {
  const { t } = useTranslation('v3stats')
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
  // [P1] 30天收入: 确定性 seed 生成 (日期键), 替代模运算伪序列
  const revenueTrend30 = DAILY_KPI_PRE.slice(-30).map((d) => ({
    day: d.date.slice(5),
    revenue: Math.round((d.examCount * 400) * (0.9 + seededUnit(`rev-${d.date}`) * 0.2)),
  }))

  const maxRevenue = Math.max(...(chartView === '7days' ? revenueTrend7 : revenueTrend30).map(d => d.revenue))

  return (
    <div>
      {/* 时间筛选 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-5, 20px)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-2, 8px)', alignItems: 'center' }}>
          <Calendar size={14} color={C.textMuted} />
          <TabButton tabs={timeRanges} active={chartView} onChange={setChartView} />
        </div>
        <button onClick={() => onExport?.()} style={{
          padding: '6px 14px', background: C.white, color: C.textMuted,
          border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 12, fontWeight: 600,
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
        }}>
          <Download size={13} /> {appT("statsPage.exportReport")}
        </button>
      </div>

      {/* 收入统计卡片 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-3, 12px)', marginBottom: 'var(--space-5, 20px)' }}>
        <StatCard label={appT("statsPage.todayRevenue")} value={appT("w9a.statsPage.currencyWan", { value: (revenueStats.today / 10000).toFixed(1) })}
          icon={<DollarSign size={20} />} color={C.success} bg={C.successBg}
          trend={{ value: '+8.2%', up: true }} />
        <StatCard label={appT("statsPage.weekRevenue")} value={appT("w9a.statsPage.currencyWan", { value: (revenueStats.week / 10000).toFixed(0) })}
          icon={<TrendingUp size={20} />} color={C.info} bg={C.infoBg}
          trend={{ value: '+12.5%', up: true }} />
        <StatCard label={appT("statsPage.monthRevenue")} value={appT("w9a.statsPage.currencyWan", { value: (revenueStats.month / 10000).toFixed(0) })}
          icon={<BarChart3 size={20} />} color={C.warning} bg={C.warningBg}
          trend={{ value: '+15.6%', up: true }} />
        <StatCard label={appT("statsPage.quarterRevenue")} value={appT("w9a.statsPage.currencyWan", { value: (revenueStats.quarter / 10000).toFixed(0) })}
          icon={<Activity size={20} />} color={C.purple} bg={C.purpleBg}
          trend={{ value: '+18.3%', up: true }} />
        <StatCard label={appT("statsPage.yoyGrowth")} value={revenueStats.yoy}
          icon={<Target size={20} />} color={C.danger} bg={C.dangerBg}
          trend={{ value: '+3.2%', up: true }} />
      </div>

      {/* 收入趋势面积图 */}
      <div style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <ChartCard title={appT("statsPage.revenueTrend")} demo>
          <ChartContainer height={280} state={(chartView === '7days' ? revenueTrend7 : revenueTrend30).length === 0 ? 'empty' : 'ready'} emptyDescription={appT("statsPage.noRevenueTrend")}>
            <AreaChart data={chartView === '7days' ? revenueTrend7 : revenueTrend30}>
              <defs>
                <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-primary-500)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--color-primary-500)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="day" tick={{ fontSize: 12, fill: C.textMuted }} />
              <YAxis tick={{ fontSize: 12, fill: C.textMuted }} domain={[0, maxRevenue * 1.2]} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: `1px solid ${C.border}` }}
                formatter={(value: number) => [appT("w9a.statsPage.currencyWan", { value: (value / 10000).toFixed(1) }), appT("statsPage.revenue")]} />
              <Area type="monotone" dataKey="revenue" stroke="var(--color-primary-500)" strokeWidth={2} fill="url(#revenueGradient)" name={appT("statsPage.chart.revenue")} />
            </AreaChart>
          </ChartContainer>
        </ChartCard>
      </div>

      {/* 下半区 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-4, 16px)', marginBottom: 'var(--space-4, 16px)' }}>
        {/* 按设备类型收入分布 */}
        <ChartCard title={appT("statsPage.revenueByDeviceType")}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4, 16px)' }}>
            <div style={{ width: 150, height: 150, flexShrink: 0 }}>
            <ChartContainer height={150} state={revenueByModality.length === 0 ? 'empty' : 'ready'} emptyDescription={appT("statsPage.noModalityRevenue")}>
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
                  <span style={{ fontSize: 12, fontWeight: 700, color: C.primary }}>¥{(item.value / 10000).toFixed(0)}{appT("statsPage.tenThousand")}</span>
                </div>
              ))}
            </div>
          </div>
        </ChartCard>

        {/* 检查类型收入排名 */}
        <ChartCard title={appT("statsPage.revenueRankByType")}>
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            {examTypeRevenue.map((item, i) => (
              <div key={item.type} style={{ display: 'flex', alignItems: 'center', padding: '6px 0', borderBottom: `1px solid ${C.border}` }}>
                <div style={{ width: 18, height: 18, borderRadius: 4, background: i < 3 ? RAD_COLORS[i] : C.background, color: i < 3 ? C.white : C.textMuted, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 'var(--space-2, 8px)' }}>
                  {i + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: C.text, fontWeight: 600 }}>{item.type}</div>
                  <div style={{ fontSize: 12, color: C.textMuted }}>{item.exams}{appT("statsPage.examUnit")}</div>
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.primary }}>¥{(item.revenue / 10000).toFixed(0)}{appT("statsPage.tenThousand")}</div>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>

      {/* 科室收入目标进度 */}
      <ChartCard title={appT("statsPage.deptTargetProgress")}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-4, 16px)' }}>
          {deptRevenueTarget.map(dept => (
            <div key={dept.dept} style={{ padding: '12px 0', borderBottom: `1px solid ${C.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{dept.dept}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: dept.rate >= 80 ? C.success : C.warning }}>
                  {dept.rate.toFixed(1)}%
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)' }}>
                <div style={{ flex: 1, height: 8, background: C.background, borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${dept.rate}%`, height: '100%', background: dept.rate >= 80 ? C.success : C.warning, borderRadius: 4 }} />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-1, 4px)' }}>
                <span style={{ fontSize: 12, color: C.textMuted }}>{appT("statsPage.actualYuan")}{(dept.actual / 10000).toFixed(0)}{appT("statsPage.tenThousand")}</span>
                <span style={{ fontSize: 12, color: C.textMuted }}>{appT("statsPage.targetYuan")}{(dept.target / 10000).toFixed(0)}{appT("statsPage.tenThousand")}</span>
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

  const trendData = trendRange === '7days' ? qualityScoreData : DAILY_KPI_PRE.map((d) => ({
    day: d.date.slice(5),
    score: d.qcAvgScore,
  }))

  return (
    <div>
      {/* 质控概览卡片 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-3, 12px)', marginBottom: 'var(--space-5, 20px)' }}>
        <StatCard label={appT("statsPage.avgQcScore")} value={appT("w9a.statsPage.scoreSuffix", { score: qualityStats.avgScore })}
          subValue={appT("statsPage.maxScore100")} icon={<Award size={20} />} color={C.success} bg={C.successBg}
          trend={{ value: appT("statsPage.plus12"), up: true }} />
        <StatCard label={appT("statsPage.overdueReports")} value={qualityStats.overtimeCount}
          subValue={appT("w9a.statsPage.overtimeRate", { rate: qualityStats.overtimeRate })} icon={<Clock size={20} />} color={C.warning} bg={C.warningBg}
          trend={{ value: '-8%', up: true }} />
        <StatCard label={appT("statsPage.criticalAlerts")} value={qualityStats.criticalCount}
          subValue={appT("statsPage.handlingRate978")} icon={<AlertTriangle size={20} />} color={C.danger} bg={C.dangerBg}
          trend={{ value: appT("statsPage.plus5Cases"), up: false }} />
        <StatCard label={appT("statsPage.revisionRate")} value="12.3%"
          subValue={appT("statsPage.down21Pct")} icon={<Edit3 size={20} />} color={C.purple} bg={C.purpleBg}
          trend={{ value: '-2.1%', up: true }} />
      </div>

      {/* 质量评分分布 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-4, 16px)', marginBottom: 'var(--space-4, 16px)' }}>
        <ChartCard title={appT("statsPage.reportQualityScoreDist")}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4, 16px)' }}>
            <div style={{ width: 150, height: 150, flexShrink: 0 }}>
            <ChartContainer height={150} state={qualityDistribution.length === 0 ? 'empty' : 'ready'} emptyDescription={appT("statsPage.noQualityDist")}>
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
          <div style={{ marginTop: 'var(--space-4, 16px)', paddingTop: 'var(--space-4, 16px)', borderTop: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 'var(--space-2, 8px)' }}>{appT("statsPage.scoreDistProgress")}</div>
            {qualityDistribution.map(item => (
              <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)', marginBottom: 6 }}>
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-3, 12px)' }}>
          <Card bordered={false} style={{ background: C.white, borderRadius: 12, padding: 'var(--space-4, 16px)', border: '1px solid var(--border-color)' }} styles={{ body: { padding: 0 } }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)', marginBottom: 'var(--space-3, 12px)' }}>
              <Clock size={16} color={C.warning} />
              <span style={{ fontSize: 12, fontWeight: 700, color: C.primary }}>{appT("statsPage.overdueStats")}</span>
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: C.warning }}>{overtimeData.total}</div>
            <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 'var(--space-2, 8px)' }}>{appT("statsPage.overdueTotal")}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
              <span style={{ fontSize: 12, color: C.textMuted }}>{appT("statsPage.overdueRate")}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.warning }}>{overtimeData.rate}%</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
              <span style={{ fontSize: 12, color: C.textMuted }}>{appT("statsPage.avgOverdue")}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{overtimeData.avgHours}h</span>
            </div>
          </Card>
          <Card bordered={false} style={{ background: C.white, borderRadius: 12, padding: 'var(--space-4, 16px)', border: '1px solid var(--border-color)' }} styles={{ body: { padding: 0 } }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)', marginBottom: 'var(--space-3, 12px)' }}>
              <AlertTriangle size={16} color={C.danger} />
              <span style={{ fontSize: 12, fontWeight: 700, color: C.primary }}>{appT("statsPage.criticalStats")}</span>
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: C.danger }}>{qualityStats.criticalCount}</div>
            <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 'var(--space-2, 8px)' }}>{appT("statsPage.criticalThisMonth")}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
              <span style={{ fontSize: 12, color: C.textMuted }}>{appT("statsPage.criticalTimelyRate")}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.success }}>{qualityStats.criticalTimelyRate}%</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
              <span style={{ fontSize: 12, color: C.textMuted }}>{appT("statsPage.criticalOverdue")}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.danger }}>{qualityStats.criticalOvertime}{appT("statsPage.caseUnit")}</span>
            </div>
          </Card>
        </div>
      </div>

      {/* 报告修改次数分布 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-4, 16px)', marginBottom: 'var(--space-4, 16px)' }}>
        <ChartCard title={appT("statsPage.revisionDist")}>
          <ChartContainer height={200} state={modificationData.length === 0 ? 'empty' : 'ready'} emptyDescription={appT("statsPage.noRevisionData")}>
            <StatBarChart data={modificationData}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="times" tick={{ fontSize: 12, fill: C.textMuted }} />
              <YAxis tick={{ fontSize: 12, fill: C.textMuted }} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: `1px solid ${C.border}` }} />
              <Bar dataKey="count" name={appT("statsPage.chart.reportCount")} radius={[4, 4, 0, 0]}>
                {modificationData.map((_, i) => <Cell key={i} fill={RAD_COLORS[i]} />)}
              </Bar>
            </StatBarChart>
          </ChartContainer>
        </ChartCard>

        <ChartCard title={appT("statsPage.overdueTimelyTrend")}>
          <ChartContainer height={200} state={sevenDayData.length === 0 ? 'empty' : 'ready'} emptyDescription={appT("statsPage.no7dData")}>
            <LineChart data={sevenDayData}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="day" tick={{ fontSize: 12, fill: C.textMuted }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: C.textMuted }} domain={[0, 'dataMax + 5']} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: `1px solid ${C.border}` }} />
              <Line type="monotone" dataKey="critical" stroke="var(--color-error-600)" strokeWidth={2} dot={{ r: 3 }} name={appT("statsPage.chart.criticalCount")} />
            </LineChart>
          </ChartContainer>
        </ChartCard>
      </div>

      {/* 质控评分趋势 */}
      <ChartCard
        title={appT("statsPage.qcScoreTrend")}
        demo
        action={
          <div style={{ display: 'flex', gap: 'var(--space-1, 4px)' }}>
            {['7days', '30days'].map(r => (
              <button key={r} onClick={() => setTrendRange(r)} style={{
                padding: '4px 10px', borderRadius: 4, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: trendRange === r ? C.infoBg : 'transparent', color: trendRange === r ? C.info : C.textMuted
              }}>{r === '7days' ? appT("statsPage.sevenDays") : appT("statsPage.thirtyDays")}</button>
            ))}
          </div>
        }
      >
          <ChartContainer height={240} state={trendData.length === 0 ? 'empty' : 'ready'} emptyDescription={appT("statsPage.noTrendData")}>
            <LineChart data={trendData}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
            <XAxis dataKey="day" tick={{ fontSize: 12, fill: C.textMuted }} />
            <YAxis tick={{ fontSize: 12, fill: C.textMuted }} domain={['dataMin - 2', 'dataMax + 2']} />
            <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: `1px solid ${C.border}` }} />
            <Line type="monotone" dataKey="score" stroke="#059669" strokeWidth={2} dot={{ r: 3 }} name={appT("statsPage.chart.qcScore")} />
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
  const [deviceFilter, setDeviceFilter] = useState('全部')
  const [deviceView, setDeviceView] = useState('utilization')

  const utilizationAvg = Math.round(deviceEfficiencyData.reduce((sum, d) => sum + d.utilization, 0) / deviceEfficiencyData.length)
  const startupAvg = Math.round(deviceStartupData.reduce((sum, d) => sum + d.startupRate, 0) / deviceStartupData.length)
  const waitAvg = (appointmentWaitData.reduce((sum, d) => sum + d.avgWait, 0) / appointmentWaitData.length).toFixed(1)

  const startupColumns: TableColumnsType<(typeof deviceStartupData)[number]> = [
    { title: appT("statsPage.deviceName"), dataIndex: 'name', key: 'name', align: 'center', render: (v: string) => <span style={{ fontWeight: 600, color: C.primary }}>{v}</span> },
    {
      title: appT("statsPage.powerOnRate"), dataIndex: 'startupRate', key: 'startupRate', align: 'center',
      render: (v: number) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
          <div style={{ width: 60, height: 6, background: C.background, borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ width: `${v}%`, height: '100%', background: v >= 95 ? C.success : v >= 90 ? C.warning : C.danger, borderRadius: 3 }} />
          </div>
          <span style={{ fontWeight: 700, color: v >= 95 ? C.success : v >= 90 ? C.warning : C.danger }}>{v}%</span>
        </div>
      ),
    },
    { title: appT("statsPage.avgStartupTime"), dataIndex: 'avgStartupTime', key: 'avgStartupTime', align: 'center', render: (v: number) => `${v}min` },
    { title: appT("statsPage.faultCount"), dataIndex: 'faults', key: 'faults', align: 'center', render: (v: number) => <span style={{ color: v > 0 ? C.danger : C.success }}>{v}</span> },
    {
      title: appT("statsPage.status"), dataIndex: 'status', key: 'status', align: 'center',
      render: (v: string) => (
        <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600, background: v === '正常' ? C.successBg : C.warningBg, color: v === '正常' ? C.success : C.warning }}>{v}</span>
      ),
    },
  ]

  const completionColumns: TableColumnsType<(typeof examCompletionTimeData)[number]> = [
    { title: appT("statsPage.deviceName"), dataIndex: 'name', key: 'name', align: 'center', render: (v: string) => <span style={{ fontWeight: 600, color: C.primary }}>{v}</span> },
    { title: appT("statsPage.completedToday"), dataIndex: 'completedToday', key: 'completedToday', align: 'center', render: (v: number) => <span style={{ fontWeight: 700, color: C.info }}>{v}</span> },
    { title: appT("statsPage.avgTime"), dataIndex: 'avgTime', key: 'avgTime', align: 'center', render: (v: number) => <span style={{ color: v > 40 ? C.warning : C.text }}>{v}min</span> },
    { title: appT("statsPage.shortest"), dataIndex: 'minTime', key: 'minTime', align: 'center', render: (v: number) => <span style={{ color: C.success }}>{v}min</span> },
    { title: appT("statsPage.longest"), dataIndex: 'maxTime', key: 'maxTime', align: 'center', render: (v: number) => <span style={{ color: C.danger }}>{v}min</span> },
    { title: appT("statsPage.overdueCount"), dataIndex: 'overtimeCount', key: 'overtimeCount', align: 'center', render: (v: number) => <span style={{ color: v > 3 ? C.danger : C.text }}>{v}</span> },
    {
      title: appT("statsPage.status"), key: 'completionStatus', align: 'center',
      render: (_v, d) => (
        <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600, background: d.overtimeCount === 0 ? C.successBg : d.overtimeCount <= 2 ? C.warningBg : C.dangerBg, color: d.overtimeCount === 0 ? C.success : d.overtimeCount <= 2 ? C.warning : C.danger }}>
          {d.overtimeCount === 0 ? appT("statsPage.normal") : d.overtimeCount <= 2 ? appT("statsPage.minor") : appT("statsPage.overdue")}
        </span>
      ),
    },
  ]

  const waitColumns: TableColumnsType<(typeof appointmentWaitData)[number]> = [
    { title: appT("statsPage.equipmentType"), dataIndex: 'modality', key: 'modality', align: 'center', render: (v: string) => <span style={{ fontWeight: 600, color: C.primary }}>{v}</span> },
    { title: appT("statsPage.avgWait"), dataIndex: 'avgWait', key: 'avgWait', align: 'center', render: (v: number) => <span style={{ color: v > 3 ? C.warning : C.success }}>{v}{appT("statsPage.daysUnit")}</span> },
    { title: appT("statsPage.maxWait"), dataIndex: 'maxWait', key: 'maxWait', align: 'center', render: (v: number) => <span style={{ color: v > 7 ? C.danger : C.text }}>{v}{appT("statsPage.daysUnit")}</span> },
    { title: appT("statsPage.todayAppointments"), dataIndex: 'todayAppointments', key: 'todayAppointments', align: 'center', render: (v: number) => <span style={{ fontWeight: 700, color: C.info }}>{v}</span> },
    { title: appT("statsPage.completed"), dataIndex: 'completed', key: 'completed', align: 'center', render: (v: number) => <span style={{ color: C.success }}>{v}</span> },
    { title: appT("statsPage.pending"), dataIndex: 'pending', key: 'pending', align: 'center', render: (v: number) => <span style={{ color: v > 10 ? C.warning : C.text }}>{v}</span> },
    {
      title: appT("statsPage.completionRate"), key: 'completionRate', align: 'center',
      render: (_v, d) => {
        const rate = ((d.completed / d.todayAppointments) * 100).toFixed(1)
        const n = parseFloat(rate)
        return (
          <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600, background: n >= 85 ? C.successBg : n >= 70 ? C.warningBg : C.dangerBg, color: n >= 85 ? C.success : n >= 70 ? C.warning : C.danger }}>{rate}%</span>
        )
      },
    },
  ]

  return (
    <div>
      {/* 设备效能概览 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-3, 12px)', marginBottom: 'var(--space-5, 20px)' }}>
        <StatCard label={appT("statsPage.totalDevices")} value={deviceEfficiencyData.length}
          subValue={appT("statsPage.running8")} icon={<Monitor size={20} />} color={C.info} bg={C.infoBg} />
        <StatCard label={appT("statsPage.avgUtilization")} value={`${utilizationAvg}%`}
          subValue={appT("statsPage.target80")} icon={<Percent size={20} />} color={C.success} bg={C.successBg}
          trend={{ value: '+3.2%', up: true }} />
        <StatCard label={appT("statsPage.avgPowerOnRate")} value={`${startupAvg}%`}
          subValue={appT("statsPage.target95")} icon={<Zap size={20} />} color={C.purple} bg={C.purpleBg}
          trend={{ value: '+1.5%', up: true }} />
        <StatCard label={appT("statsPage.avgApptWait")} value={appT("w9a.statsPage.daysSuffix", { count: waitAvg })}
          subValue={appT("statsPage.ctMrBusy")} icon={<Clock size={20} />} color={C.warning} bg={C.warningBg}
          trend={{ value: appT("statsPage.plus03days"), up: false }} />
        <StatCard label={appT("statsPage.totalFaults")} value={deviceEfficiencyData.reduce((s, d) => s + d.faults, 0)}
          subValue={appT("statsPage.maint1")} icon={<Wrench size={20} />} color={C.danger} bg={C.dangerBg}
          trend={{ value: appT("statsPage.minus2"), up: true }} />
      </div>

      {/* 设备视图切换 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4, 16px)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-1, 4px)', background: C.background, borderRadius: 8, padding: 'var(--space-1, 4px)' }}>
          {[{ key: 'utilization', label: appT("statsPage.utilization") }, { key: 'startup', label: appT("statsPage.powerOnRate") }, { key: 'completion', label: appT("statsPage.completionTime") }, { key: 'wait', label: appT("statsPage.waitTime") }].map(v => (
            <button key={v.key} onClick={() => setDeviceView(v.key)} style={{
              padding: '5px 12px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600,
              cursor: 'pointer', background: deviceView === v.key ? C.white : 'transparent',
              color: deviceView === v.key ? C.primary : C.textMuted,
              boxShadow: deviceView === v.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
            }}>{v.label}</button>
          ))}
        </div>
        <label htmlFor="device-filter" style={{ position: 'absolute', left: -9999 }}>{appT("statsPage.deviceTypeFilter")}</label>
        <Select id="device-filter" aria-label={appT("statsPage.deviceTypeFilter")} size="small" style={{ minWidth: 120 }} value={deviceFilter} onChange={(v) => setDeviceFilter(v)} options={['全部', 'CT', 'MR', 'DR', 'DSA', 'MG', 'GI'].map(m => ({ value: m, label: m }))} />
      </div>

      {/* 设备利用率视图 */}
      {deviceView === 'utilization' && (
        <>
          <Card bordered={false} style={{ background: C.white, borderRadius: 12, border: '1px solid var(--border-color)', marginBottom: 'var(--space-5, 20px)', overflow: 'hidden' }} styles={{ body: { padding: 0 } }}>
            <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.primary }}>{appT("statsPage.deviceList")}</div>
            </div>
            <VirtualTable
              columns={[
                { title: appT("statsPage.deviceName"), dataIndex: 'name', key: 'name', render: (v: string) => <span style={{ fontSize: 12, fontWeight: 600, color: C.primary }}>{v}</span> },
                { title: appT("statsPage.deviceType"), dataIndex: 'name', key: 'type', render: (v: string) => <span style={{ fontSize: 12 }}>{v.split('-')[0]}</span> },
                { title: appT("statsPage.examVolume"), dataIndex: 'exams', key: 'exams', width: 90, render: (v: number) => <span style={{ fontSize: 12, fontWeight: 700, color: C.info }}>{v}</span> },
                { title: appT("statsPage.avgDuration"), dataIndex: 'avgTime', key: 'avgTime', width: 100, render: (v: number) => <span style={{ fontSize: 12 }}>{v}min</span> },
                {
                  title: appT("statsPage.utilizationRate"), dataIndex: 'utilization', key: 'utilization', width: 160,
                  render: (v: number) => (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                      <div style={{ width: 60, height: 6, background: C.background, borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${v}%`, height: '100%', background: v >= 80 ? C.success : v >= 60 ? C.warning : C.danger, borderRadius: 3 }} />
                      </div>
                      <span style={{ fontWeight: 700, color: v >= 80 ? C.success : v >= 60 ? C.warning : C.danger }}>{v}%</span>
                    </div>
                  ),
                },
                { title: appT("statsPage.faultCount"), dataIndex: 'faults', key: 'faults', width: 90, render: (v: number) => <span style={{ fontSize: 12, color: v > 0 ? C.danger : C.success }}>{v}</span> },
                {
                  title: appT("statsPage.maintenanceStatus"), dataIndex: 'status', key: 'status', width: 100,
                  render: (v: string) => (
                    <span style={{
                      padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600,
                      background: v === '正常' ? C.successBg : C.warningBg,
                      color: v === '正常' ? C.success : C.warning
                    }}>{v}</span>
                  ),
                },
              ]}
              dataSource={deviceEfficiencyData.filter(d => deviceFilter === '全部' || d.name.includes(deviceFilter))}
              rowKey="name"
              height={400}
              pageSize={10}
            />
          </Card>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-4, 16px)', marginBottom: 'var(--space-4, 16px)' }}>
            <ChartCard title={appT("statsPage.utilizationCompare")}>
          <ChartContainer height={240} state={deviceEfficiencyData.length === 0 ? 'empty' : 'ready'} emptyDescription={appT("statsPage.noDeviceEfficiency")}>
            <StatBarChart data={deviceEfficiencyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: C.textMuted }} />
                  <YAxis tick={{ fontSize: 12, fill: C.textMuted }} domain={[0, 100]} />
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: `1px solid ${C.border}` }} />
                  <Bar dataKey="utilization" name={appT("statsPage.chart.utilizationPct")} radius={[4, 4, 0, 0]}>
                    {deviceEfficiencyData.map((entry, i) => (
                      <Cell key={i} fill={entry.utilization >= 80 ? C.success : entry.utilization >= 60 ? C.warning : C.danger} />
                    ))}
                  </Bar>
                </StatBarChart>
              </ChartContainer>
            </ChartCard>

            <ChartCard title={appT("statsPage.maintenancePlanList")}>
              <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                {maintenanceData.map(m => (
                  <div key={m.device} style={{ padding: '10px 0', borderBottom: `1px solid ${C.border}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-1, 4px)' }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{m.device}</span>
                      <span style={{
                        padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600,
                        background: m.daysLeft <= 14 ? C.dangerBg : m.daysLeft <= 30 ? C.warningBg : C.infoBg,
                        color: m.daysLeft <= 14 ? C.danger : m.daysLeft <= 30 ? C.warning : C.info
                      }}>
                        {m.daysLeft <= 14 ? appT("statsPage.urgent") : m.daysLeft <= 30 ? appT("statsPage.dueSoon") : appT("statsPage.normal")}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 12, color: C.textMuted }}>{m.type}</span>
                      <span style={{ fontSize: 12, color: C.textMuted }}>{appT("statsPage.remaining")} <strong style={{ color: m.daysLeft <= 14 ? C.danger : C.text }}>{m.daysLeft}</strong> {appT("statsPage.daysUnit")}</span>
                    </div>
                    <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{appT("statsPage.plannedDate")} {m.nextDate}</div>
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
          <Card bordered={false} style={{ background: C.white, borderRadius: 12, border: '1px solid var(--border-color)', marginBottom: 'var(--space-5, 20px)', overflow: 'hidden' }} styles={{ body: { padding: 0 } }}>
            <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.primary }}>{appT("statsPage.powerOnDetail")}</div>
            </div>
            <DataTable<(typeof deviceStartupData)[number]>
              columns={startupColumns}
              dataSource={deviceStartupData.filter(d => deviceFilter === '全部' || d.name.includes(deviceFilter))}
              rowKey="name"
            />
          </Card>

          <ChartCard title={appT("statsPage.powerOnCompare")}>
          <ChartContainer height={280} state={deviceStartupData.length === 0 ? 'empty' : 'ready'} emptyDescription={appT("statsPage.noPowerOnData")}>
            <StatBarChart data={deviceStartupData}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: C.textMuted }} />
                <YAxis tick={{ fontSize: 12, fill: C.textMuted }} domain={[80, 100]} />
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: `1px solid ${C.border}` }} />
                <Bar dataKey="startupRate" name={appT("statsPage.chart.startupRatePct")} radius={[4, 4, 0, 0]}>
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
          <Card bordered={false} style={{ background: C.white, borderRadius: 12, border: '1px solid var(--border-color)', marginBottom: 'var(--space-5, 20px)', overflow: 'hidden' }} styles={{ body: { padding: 0 } }}>
            <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.primary }}>{appT("statsPage.completionStats")}</div>
            </div>
            <DataTable<(typeof examCompletionTimeData)[number]>
              columns={completionColumns}
              dataSource={examCompletionTimeData.filter(d => deviceFilter === '全部' || d.name.includes(deviceFilter))}
              rowKey="name"
            />
          </Card>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-4, 16px)' }}>
            <ChartCard title={appT("statsPage.avgTimeCompare")}>
          <ChartContainer height={240} state={examCompletionTimeData.length === 0 ? 'empty' : 'ready'} emptyDescription={appT("statsPage.noDurationData")}>
            <StatBarChart data={examCompletionTimeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: C.textMuted }} />
                  <YAxis tick={{ fontSize: 12, fill: C.textMuted }} />
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: `1px solid ${C.border}` }} />
                  <Bar dataKey="avgTime" name={appT("statsPage.chart.avgTimeMin")} radius={[4, 4, 0, 0]}>
                    {examCompletionTimeData.map((entry, i) => (
                      <Cell key={i} fill={entry.avgTime <= 15 ? C.success : entry.avgTime <= 30 ? C.warning : C.danger} />
                    ))}
                  </Bar>
                </StatBarChart>
              </ChartContainer>
            </ChartCard>

            <ChartCard title={appT("statsPage.completionDist")}>
          <ChartContainer height={240} state={examCompletionTimeData.length === 0 ? 'empty' : 'ready'} emptyDescription={appT("statsPage.noDurationData")}>
            <StatBarChart data={examCompletionTimeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: C.textMuted }} />
                  <YAxis tick={{ fontSize: 12, fill: C.textMuted }} />
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: `1px solid ${C.border}` }} />
                  <Legend iconSize={10} verticalAlign="bottom" align="center" />
                  <Bar dataKey="minTime" name={appT("statsPage.chart.minTime")} fill="#059669" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="maxTime" name={appT("statsPage.chart.maxTime")} fill="var(--color-error-600)" radius={[4, 4, 0, 0]} />
                </StatBarChart>
              </ChartContainer>
            </ChartCard>
          </div>
        </>
      )}

      {/* 预约等待时间视图 */}
      {deviceView === 'wait' && (
        <>
          <Card bordered={false} style={{ background: C.white, borderRadius: 12, border: '1px solid var(--border-color)', marginBottom: 'var(--space-5, 20px)', overflow: 'hidden' }} styles={{ body: { padding: 0 } }}>
            <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.primary }}>{appT("statsPage.apptWaitStats")}</div>
            </div>
            <DataTable<(typeof appointmentWaitData)[number]>
              columns={waitColumns}
              dataSource={appointmentWaitData}
              rowKey="modality"
            />
          </Card>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-4, 16px)' }}>
            <ChartCard title={appT("statsPage.apptWaitByDevice2")}>
          <ChartContainer height={240} state={appointmentWaitData.length === 0 ? 'empty' : 'ready'} emptyDescription={appT("statsPage.noApptWaitData")}>
            <StatBarChart data={appointmentWaitData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                  <XAxis dataKey="modality" tick={{ fontSize: 12, fill: C.textMuted }} />
                  <YAxis tick={{ fontSize: 12, fill: C.textMuted }} />
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: `1px solid ${C.border}` }} />
                  <Bar dataKey="avgWait" name={appT("statsPage.chart.avgWaitDays")} radius={[4, 4, 0, 0]}>
                    {appointmentWaitData.map((entry, i) => (
                      <Cell key={i} fill={entry.avgWait <= 2 ? C.success : entry.avgWait <= 4 ? C.warning : C.danger} />
                    ))}
                  </Bar>
                </StatBarChart>
              </ChartContainer>
            </ChartCard>

            <ChartCard title={appT("statsPage.waitTrendBySlot")}>
          <ChartContainer height={240} state={waitTimeTrendData.length === 0 ? 'empty' : 'ready'} emptyDescription={appT("statsPage.noWaitTrend")}>
            <LineChart data={waitTimeTrendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                  <XAxis dataKey="slot" tick={{ fontSize: 12, fill: C.textMuted }} />
                  <YAxis tick={{ fontSize: 12, fill: C.textMuted }} />
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: `1px solid ${C.border}` }} />
                  <Legend iconSize={10} verticalAlign="bottom" align="center" />
                  <Line type="monotone" dataKey="CT" stroke="var(--color-primary-500)" strokeWidth={2} dot={{ r: 3 }} name="CT" />
                  <Line type="monotone" dataKey="MR" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} name="MR" />
                  <Line type="monotone" dataKey="DR" stroke="var(--color-success-500)" strokeWidth={2} dot={{ r: 3 }} name="DR" />
                </LineChart>
              </ChartContainer>
            </ChartCard>
          </div>
        </>
      )}

      {/* 设备使用时段热力图 - 显示在利用率视图底部 */}
      {deviceView === 'utilization' && (
        <ChartCard title={appT("statsPage.heatmapTitle")}>
          <div style={{ overflowX: 'auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '60px repeat(7, 1fr)', gap: 2, minWidth: 500 }}>
              <div style={{ fontSize: 12, color: C.textMuted, textAlign: 'center', padding: 'var(--space-1, 4px)' }}></div>
              {[appT("statsPage.monday"), appT("statsPage.tuesday"), appT("statsPage.wednesday"), appT("statsPage.thursday"), appT("statsPage.friday"), appT("statsPage.saturday"), appT("statsPage.sunday")].map(d => (
                <div key={d} style={{ fontSize: 12, color: C.textMuted, textAlign: 'center', padding: 'var(--space-1, 4px)', fontWeight: 600 }}>{d}</div>
              ))}
              {heatmapData.map(row => (
                <Fragment key={row.hour}>
                  <div style={{ fontSize: 12, color: C.textMuted, textAlign: 'center', padding: 'var(--space-1, 4px)' }}>{row.hour}</div>
                  {HEATMAP_DAYS.map((d) => {
                    const val = row[d as keyof typeof row] as number
                    const intensity = Math.min(val / HEATMAP_MAX, 1)
                    return (
                      <div key={`${row.hour}-${d}`} style={{
                        background: `rgba(59, 130, 246, ${intensity})`,
                        borderRadius: 3, padding: '4px 2px', textAlign: 'center', minHeight: 24
                      }}>
                        <span style={{ fontSize: 12, color: intensity > 0.5 ? C.white : C.textMuted, fontWeight: val > HEATMAP_MAX * 0.6 ? 700 : 400 }}>{val}</span>
                      </div>
                    )
                  })}
                </Fragment>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)', marginTop: 'var(--space-3, 12px)', justifyContent: 'flex-end' }}>
            <span style={{ fontSize: 12, color: C.textMuted }}>{appT("statsPage.intensityLabel")}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)' }}>
              <div style={{ width: 16, height: 10, background: 'rgba(59,130,246,0.1)', borderRadius: 2 }} />
              <span style={{ fontSize: 12, color: C.textMuted }}>{appT("statsPage.low")}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)' }}>
              <div style={{ width: 16, height: 10, background: 'rgba(59,130,246,0.4)', borderRadius: 2 }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)' }}>
              <div style={{ width: 16, height: 10, background: 'rgba(59,130,246,0.7)', borderRadius: 2 }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)' }}>
              <div style={{ width: 16, height: 10, background: 'rgba(59,130,246,1)', borderRadius: 2 }} />
              <span style={{ fontSize: 12, color: C.textMuted }}>{appT("statsPage.high")}</span>
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
  const patientStats = {
    total: 568,
    avgAge: 48.5,
    positiveRate: 38.2,
    criticalCount: 45,
  }

  return (
    <div>
      {/* 患者分析概览 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-3, 12px)', marginBottom: 'var(--space-5, 20px)' }}>
        <StatCard label={appT("statsPage.patientsThisMonth")} value={patientStats.total}
          subValue={appT("statsPage.patientMix")} icon={<Users size={20} />} color={C.info} bg={C.infoBg}
          trend={{ value: '+6.8%', up: true }} />
        <StatCard label={appT("statsPage.avgAge")} value={appT("w9a.statsPage.yearsSuffix", { count: patientStats.avgAge })}
          subValue={appT("statsPage.genderRatio5545")} icon={<UserCheck size={20} />} color={C.purple} bg={C.purpleBg} />
        <StatCard label={appT("statsPage.overallPositiveRate")} value={`${patientStats.positiveRate}%`}
          subValue={appT("statsPage.aboveNationalAvg")} icon={<ShieldCheck size={20} />} color={C.success} bg={C.successBg}
          trend={{ value: '+2.1%', up: false }} />
        <StatCard label={appT("statsPage.criticalPatients")} value={patientStats.criticalCount}
          subValue={appT("statsPage.timelyHandle978")} icon={<AlertTriangle size={20} />} color={C.danger} bg={C.dangerBg}
          trend={{ value: appT("statsPage.plus5Cases"), up: false }} />
      </div>

      {/* 患者来源与年龄分布 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-4, 16px)', marginBottom: 'var(--space-4, 16px)' }}>
        {/* 患者来源分布 */}
        <ChartCard title={appT("statsPage.patientSourceDist")}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4, 16px)' }}>
            <div style={{ width: 160, height: 160, flexShrink: 0 }}>
            <ChartContainer height={160} state={patientSourceData.length === 0 ? 'empty' : 'ready'} emptyDescription={appT("statsPage.noPatientSource")}>
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)' }}>
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
        <ChartCard title={appT("statsPage.genderDist")}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4, 16px)' }}>
            <div style={{ width: 160, height: 160, flexShrink: 0 }}>
            <ChartContainer height={160} state={genderDistribution.length === 0 ? 'empty' : 'ready'} emptyDescription={appT("statsPage.noGenderDist")}>
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
                    <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{item.name}</span>
                  </div>
                  <span style={{ fontSize: 18, fontWeight: 800, color: C.primary }}>{item.value}%</span>
                </div>
              ))}
              <div style={{ marginTop: 'var(--space-3, 12px)', padding: 'var(--space-2, 8px)', background: C.background, borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 12, color: C.textMuted }}>{appT("statsPage.genderRatio")}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: C.primary }}>55 : 45</div>
              </div>
            </div>
          </div>
        </ChartCard>
      </div>

      {/* 年龄分布柱状图 */}
      <div style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <ChartCard title={appT("statsPage.ageDist")}>
          <ChartContainer height={240} state={ageDistributionData.length === 0 ? 'empty' : 'ready'} emptyDescription={appT("statsPage.noAgeDist")}>
            <StatBarChart data={ageDistributionData}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="range" tick={{ fontSize: 12, fill: C.textMuted }} />
              <YAxis tick={{ fontSize: 12, fill: C.textMuted }} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: `1px solid ${C.border}` }} />
              <Legend iconSize={10} verticalAlign="bottom" align="center" />
              <Bar dataKey="male" name={appT("statsPage.chart.male")} fill="var(--color-primary-500)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="female" name={appT("statsPage.chart.female")} fill="#ec4899" radius={[4, 4, 0, 0]} />
            </StatBarChart>
          </ChartContainer>
        </ChartCard>
      </div>

      {/* 阳性率对比与趋势 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-4, 16px)' }}>
        {/* 各设备危急值率 */}
        <ChartCard title={appT("statsPage.positiveByDevice")}>
          <ChartContainer height={220} state={positiveRateData.length === 0 ? 'empty' : 'ready'} emptyDescription={appT("statsPage.noPositiveRate")}>
            <StatBarChart data={positiveRateData}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="modality" tick={{ fontSize: 12, fill: C.textMuted }} />
              <YAxis tick={{ fontSize: 12, fill: C.textMuted }} domain={[0, 100]} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: `1px solid ${C.border}` }} />
              <Bar dataKey="rate" name={appT("statsPage.criticalRatePct")} radius={[4, 4, 0, 0]}>
                {positiveRateData.map((entry, i) => (
                  <Cell key={i} fill={entry.rate >= 50 ? C.danger : entry.rate >= 30 ? C.warning : C.success} />
                ))}
              </Bar>
            </StatBarChart>
          </ChartContainer>
        </ChartCard>

        {/* 阳性率趋势 */}
        <ChartCard title={appT("statsPage.positive7dTrend")}>
          <ChartContainer height={220} state={positiveTrendData.length === 0 ? 'empty' : 'ready'} emptyDescription={appT("statsPage.noPositiveTrend")}>
            <LineChart data={positiveTrendData}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="day" tick={{ fontSize: 12, fill: C.textMuted }} />
              <YAxis tick={{ fontSize: 12, fill: C.textMuted }} domain={['dataMin - 5', 'dataMax + 5']} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: `1px solid ${C.border}` }} />
              <Line type="monotone" dataKey="rate" stroke="#059669" strokeWidth={2} dot={{ r: 4 }} name={appT("statsPage.chart.positiveRatePct")} />
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
  const [timeRange, setTimeRange] = useState('week')
  const [positiveType, setPositiveType] = useState('all')

  const timeRanges = [
    { key: 'today', label: appT("statsPage.today") },
    { key: 'week', label: appT("statsPage.thisWeek") },
    { key: 'month', label: appT("statsPage.thisMonth") },
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-5, 20px)', flexWrap: 'wrap', gap: 'var(--space-3, 12px)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-2, 8px)', alignItems: 'center' }}>
          <Calendar size={14} color={C.textMuted} />
          <div style={{ display: 'flex', gap: 'var(--space-1, 4px)', background: C.background, borderRadius: 8, padding: 'var(--space-1, 4px)' }}>
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
        <div style={{ display: 'flex', gap: 'var(--space-2, 8px)', alignItems: 'center' }}>
          <Filter size={14} color={C.textMuted} aria-hidden="true" />
          <label htmlFor="positive-type-filter" style={{ position: 'absolute', left: -9999 }}>{appT("statsPage.positiveTypeFilter")}</label>
          <Select id="positive-type-filter" aria-label={appT("statsPage.positiveTypeFilter")} size="small" style={{ minWidth: 120 }} value={positiveType} onChange={(v) => setPositiveType(v)} options={[
            { value: 'all', label: appT("statsPage.allTypes") },
            { value: 'CT', label: 'CT' },
            { value: 'MR', label: 'MR' },
            { value: 'DR', label: 'DR' },
            { value: 'DSA', label: 'DSA' },
          ]} />
        </div>
      </div>

      {/* 阳性率概览卡片 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-3, 12px)', marginBottom: 'var(--space-5, 20px)' }}>
        <StatCard label={appT("statsPage.overallPositiveRate")} value={`${positiveStats.overallRate}%`}
          subValue={appT("statsPage.monthlyStats")} icon={<ShieldCheck size={20} />} color={C.success} bg={C.successBg}
          trend={{ value: positiveStats.momChange, up: false }} />
        <StatCard label={appT("statsPage.positiveCases")} value={positiveStats.positiveCount}
          subValue={appT("w9a.statsPage.examsSuffix", { count: positiveStats.totalExams })} icon={<AlertTriangle size={20} />} color={C.danger} bg={C.dangerBg}
          trend={{ value: appT("statsPage.plus32"), up: false }} />
        <StatCard label={appT("statsPage.retakeRate")} value={`${positiveStats.reexamRate}%`}
          subValue={appT("statsPage.dueToImageQuality")} icon={<RefreshCw size={20} />} color={C.warning} bg={C.warningBg}
          trend={{ value: '-0.5%', up: true }} />
        <StatCard label={appT("statsPage.yoyChange")} value={positiveStats.yoyChange}
          subValue={appT("statsPage.vsLastYear")} icon={<TrendingUp size={20} />} color={C.info} bg={C.infoBg}
          trend={{ value: '+0.8%', up: true }} />
      </div>

      {/* 阳性率趋势图（30天） */}
      <div style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <ChartCard title={appT("statsPage.positive30dTrend")} demo>
          <ChartContainer height={260} state={positiveRateTrend30Days.length === 0 ? 'empty' : 'ready'} emptyDescription={appT("statsPage.no30dPositive")}>
            <LineChart data={positiveRateTrend30Days}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="day" tick={{ fontSize: 12, fill: C.textMuted }} />
              <YAxis tick={{ fontSize: 12, fill: C.textMuted }} domain={['dataMin - 5', 'dataMax + 5']} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: `1px solid ${C.border}` }} />
              <Legend iconSize={10} verticalAlign="bottom" align="center" />
              <Line type="monotone" dataKey="rate" stroke="#059669" strokeWidth={2} dot={{ r: 2 }} name={appT("statsPage.chart.positiveRatePct")} />
              <Line type="monotone" dataKey="critical" stroke="var(--color-error-600)" strokeWidth={1.5} dot={{ r: 2 }} name={appT("statsPage.chart.criticalCount")} />
            </LineChart>
          </ChartContainer>
        </ChartCard>
      </div>

      {/* 阳性率排名与复查率 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-4, 16px)', marginBottom: 'var(--space-4, 16px)' }}>
        {/* 阳性率排名 */}
        <ChartCard title={appT("statsPage.positiveTop8")}>
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
                  <div style={{ fontSize: 12, color: C.textMuted }}>{item.count} {appT("statsPage.examUnit")}</div>
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
        <ChartCard title={appT("statsPage.retakeByType")}>
          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
            {reexaminationData.map((item) => (
              <div key={item.type} style={{ padding: '10px 0', borderBottom: `1px solid ${C.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{item.type}</span>
                  <span style={{
                    padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600,
                    background: item.reexamRate >= 10 ? C.dangerBg : item.reexamRate >= 5 ? C.warningBg : C.successBg,
                    color: item.reexamRate >= 10 ? C.danger : item.reexamRate >= 5 ? C.warning : C.success
                  }}>
                    {appT("statsPage.retakeRate")} {item.reexamRate}%
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)', marginBottom: 'var(--space-1, 4px)' }}>
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
                  <span style={{ fontSize: 12, color: C.textMuted }}>{appT("statsPage.avgInterval")} {item.avgDays} {appT("statsPage.daysUnit")}</span>
                  <span style={{ fontSize: 12, color: C.textMuted }}>{appT("statsPage.reasonLabel")} {item.reason}</span>
                </div>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>

      {/* 各设备阳性率与复查率对比 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-4, 16px)' }}>
        <ChartCard title={appT("statsPage.positiveDistByDevice")}>
          <ChartContainer height={240} state={positiveRateData.length === 0 ? 'empty' : 'ready'} emptyDescription={appT("statsPage.noPositiveRate")}>
            <StatBarChart data={positiveRateData}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="modality" tick={{ fontSize: 12, fill: C.textMuted }} />
              <YAxis tick={{ fontSize: 12, fill: C.textMuted }} domain={[0, 100]} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: `1px solid ${C.border}` }} />
              <Bar dataKey="rate" name={appT("statsPage.criticalRatePct")} radius={[4, 4, 0, 0]}>
                {positiveRateData.map((entry, i) => (
                  <Cell key={i} fill={entry.rate >= 50 ? C.danger : entry.rate >= 30 ? C.warning : C.success} />
                ))}
              </Bar>
            </StatBarChart>
          </ChartContainer>
        </ChartCard>

        <ChartCard title={appT("statsPage.positive7dTrend2")}>
          <ChartContainer height={240} state={positiveTrendData.length === 0 ? 'empty' : 'ready'} emptyDescription={appT("statsPage.noPositiveTrend")}>
            <LineChart data={positiveTrendData}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="day" tick={{ fontSize: 12, fill: C.textMuted }} />
              <YAxis tick={{ fontSize: 12, fill: C.textMuted }} domain={['dataMin - 5', 'dataMax + 5']} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: `1px solid ${C.border}` }} />
              <Line type="monotone" dataKey="rate" stroke="#059669" strokeWidth={2} dot={{ r: 4 }} name={appT("statsPage.chart.positiveRatePct")} />
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
function BusinessAnalysisTab({ onExportBusiness }: { onExportBusiness?: () => void }) {
  const { t } = useTranslation('v3stats')
  const [timeRange, setTimeRange] = useState('month')

  const timeRanges = [
    { key: 'month', label: appT("statsPage.thisMonth") },
    { key: 'quarter', label: appT("statsPage.thisQuarter") },
    { key: 'year', label: appT("statsPage.thisYear") },
  ]

  const profitMargin = ((businessStats.netProfit / businessStats.totalRevenue) * 100).toFixed(1)

  const deptProfitColumns: TableColumnsType<(typeof efficiencyMetrics)[number]> = [
    { title: appT("statsPage.department"), dataIndex: 'dept', key: 'dept', align: 'center', render: (v: string) => <span style={{ fontWeight: 600, color: C.primary }}>{v}</span> },
    { title: appT("statsPage.revenueWan"), dataIndex: 'revenue', key: 'revenue', align: 'center', render: (v: number) => <span style={{ color: C.success }}>{(v / 10000).toFixed(0)}</span> },
    { title: appT("statsPage.costWan"), dataIndex: 'cost', key: 'cost', align: 'center', render: (v: number) => <span style={{ color: C.danger }}>{(v / 10000).toFixed(0)}</span> },
    { title: appT("statsPage.profitWan"), dataIndex: 'profit', key: 'profit', align: 'center', render: (v: number) => <span style={{ fontWeight: 700, color: C.info }}>{(v / 10000).toFixed(0)}</span> },
    { title: appT("statsPage.staffCount"), dataIndex: 'staff', key: 'staff', align: 'center' },
    { title: appT("statsPage.perCapitaProfitWan"), dataIndex: 'perCapita', key: 'perCapita', align: 'center', render: (v: number) => <span style={{ fontWeight: 700, color: C.primary }}>{(v / 10000).toFixed(1)}</span> },
    {
      title: appT("statsPage.profitRate"), key: 'profitRate', align: 'center',
      render: (_v, dept) => {
        const rate = ((dept.profit / dept.revenue) * 100).toFixed(1)
        const n = parseFloat(rate)
        return (
          <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600, background: n >= 45 ? C.successBg : n >= 35 ? C.warningBg : C.dangerBg, color: n >= 45 ? C.success : n >= 35 ? C.warning : C.danger }}>{rate}%</span>
        )
      },
    },
  ]

  return (
    <div>
      {/* 筛选栏 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-5, 20px)', flexWrap: 'wrap', gap: 'var(--space-3, 12px)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-2, 8px)', alignItems: 'center' }}>
          <Calendar size={14} color={C.textMuted} />
          <div style={{ display: 'flex', gap: 'var(--space-1, 4px)', background: C.background, borderRadius: 8, padding: 'var(--space-1, 4px)' }}>
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
        <button onClick={() => onExportBusiness?.()} style={{
          padding: '6px 14px', background: C.white, color: C.textMuted,
          border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 12, fontWeight: 600,
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
        }}>
          <Download size={13} /> {t('statistics.exportBusinessReport')}
        </button>
      </div>

      {/* 经营概览卡片 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-3, 12px)', marginBottom: 'var(--space-5, 20px)' }}>
        <StatCard label={appT("statsPage.totalRevenue")} value={appT("w9a.statsPage.currencyWan", { value: (businessStats.totalRevenue / 10000).toFixed(0) })}
          subValue={appT("statsPage.monthCumulative")} icon={<DollarSign size={20} />} color={C.success} bg={C.successBg}
          trend={{ value: businessStats.yoyRevenue, up: true }} />
        <StatCard label={appT("statsPage.totalCost")} value={appT("w9a.statsPage.currencyWan", { value: (businessStats.totalCost / 10000).toFixed(0) })}
          subValue={appT("statsPage.costRate53B")} icon={<BarChart3 size={20} />} color={C.warning} bg={C.warningBg}
          trend={{ value: '+8.2%', up: false }} />
        <StatCard label={appT("statsPage.netProfit")} value={appT("w9a.statsPage.currencyWan", { value: (businessStats.netProfit / 10000).toFixed(0) })}
          subValue={appT("w9a.statsPage.profitMargin", { rate: profitMargin })} icon={<TrendingUp size={20} />} color={C.info} bg={C.infoBg}
          trend={{ value: businessStats.yoyProfit, up: true }} />
        <StatCard label={appT("statsPage.perCapitaOutput")} value={appT("w9a.statsPage.currencyWan", { value: (businessStats.perCapitaRevenue / 10000).toFixed(1) })}
          subValue={appT("statsPage.perCapitaProfit875")} icon={<Award size={20} />} color={C.purple} bg={C.purpleBg}
          trend={{ value: '+12.3%', up: true }} />
      </div>

      {/* 月度利润趋势（面积图） */}
      <div style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <ChartCard title={appT("statsPage.monthlyProfitTrend")} demo>
          <ChartContainer height={280} state={monthlyProfitData.length === 0 ? 'empty' : 'ready'} emptyDescription={appT("statsPage.noMonthlyProfit")}>
            <AreaChart data={monthlyProfitData}>
              <defs>
                <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#059669" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-error-600)" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="var(--color-error-600)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: C.textMuted }} />
              <YAxis tick={{ fontSize: 12, fill: C.textMuted }} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: `1px solid ${C.border}` }} />
              <Legend iconSize={10} verticalAlign="bottom" align="center" />
              <Area type="monotone" dataKey="revenue" stroke="#059669" strokeWidth={2} fill="url(#revenueGrad)" name={appT("statsPage.chart.revenue")} />
              <Area type="monotone" dataKey="cost" stroke="var(--color-error-600)" strokeWidth={2} fill="url(#costGrad)" name={appT("statsPage.chart.cost")} />
              <Line type="monotone" dataKey="profit" stroke="var(--color-primary-600)" strokeWidth={2} dot={{ r: 4 }} name={appT("statsPage.chart.profit")} />
            </AreaChart>
          </ChartContainer>
        </ChartCard>
      </div>

      {/* 成本结构与人均产出 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-4, 16px)', marginBottom: 'var(--space-4, 16px)' }}>
        {/* 成本结构饼图 */}
        <ChartCard title={appT("statsPage.costStructure")}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4, 16px)' }}>
            <div style={{ width: 150, height: 150, flexShrink: 0 }}>
            <ChartContainer height={150} state={costBreakdown.length === 0 ? 'empty' : 'ready'} emptyDescription={appT("statsPage.noCostComposition")}>
              <StatPieChart>
                <Pie data={costBreakdown} cx="50%" cy="50%" innerRadius={42} outerRadius={65} paddingAngle={2} dataKey="value">
                  {costBreakdown.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} formatter={(v: number) => appT("w9a.statsPage.currencyWan", { value: (v / 10000).toFixed(0) })} />
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
                    <span style={{ fontSize: 12, fontWeight: 700, color: C.primary }}>¥{(item.value / 10000).toFixed(0)}{appT("statsPage.tenThousand")}</span>
                    <span style={{ fontSize: 12, color: C.textMuted, marginLeft: 'var(--space-1, 4px)' }}>({item.percent}%)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </ChartCard>

        {/* 人均产出趋势 */}
        <ChartCard title={appT("statsPage.perCapitaTrend")} demo>
          <ChartContainer height={220} state={perCapitaTrend.length === 0 ? 'empty' : 'ready'} emptyDescription={appT("statsPage.noPerCapitaCost")}>
            <LineChart data={perCapitaTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: C.textMuted }} />
              <YAxis tick={{ fontSize: 12, fill: C.textMuted }} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: `1px solid ${C.border}` }}
                formatter={(value: number) => appT("w9a.statsPage.currencyWan", { value: (value / 10000).toFixed(1) })} />
              <Legend iconSize={10} verticalAlign="bottom" align="center" />
              <Line type="monotone" dataKey="revenue" stroke="var(--color-primary-600)" strokeWidth={2} dot={{ r: 3 }} name={appT("statsPage.chart.perCapitaRevenue")} />
              <Line type="monotone" dataKey="profit" stroke="#059669" strokeWidth={2} dot={{ r: 3 }} name={appT("statsPage.chart.perCapitaProfit")} />
            </LineChart>
          </ChartContainer>
        </ChartCard>
      </div>

      {/* 科室效益排名表 */}
      <ChartCard title={appT("statsPage.deptProfitAnalysis")}>
        <DataTable<(typeof efficiencyMetrics)[number]>
          columns={deptProfitColumns}
          dataSource={efficiencyMetrics}
          rowKey="dept"
        />
      </ChartCard>
    </div>
  )
}

// ============================================================
// [G005 v3.0.6.11-99 Wave 10E-1] 深度分析 Tab
//   D1. 科室对比雷达 (多科室 6 指标)
//   D2. 设备 TOP 排行 (使用率/检查量双榜)
//   D3. 医生工作量构成 (堆叠: 初核/终核/双签)
//   D4. 危急值响应时间分布
// 数据源: biApi + statsApi 真实接口优先, 失败回退派生数据 (徽标标注)
// ============================================================
const DEEP_DEPTS = [appT("statsPage.radiologyDept"), appT("statsPage.roomCt"), appT("statsPage.roomMri"), appT("statsPage.emergencyDept"), appT("statsPage.cathLabDept")]

const DEEP_RADAR_INDICATORS = [
  { key: 'volume', label: appT("statsPage.examVolume") },
  { key: 'positiveRate', label: appT("statsPage.positiveRate") },
  { key: 'timeliness', label: appT("statsPage.timeliness") },
  { key: 'quality', label: appT("statsPage.qcScore") },
  { key: 'critical', label: appT("statsPage.criticalHandling") },
  { key: 'utilization', label: appT("statsPage.deviceUtilization") },
]

const DeepAnalysisTab: React.FC = () => {
  const [source, setSource] = useState<'api' | 'demo'>('demo')
  const [sourceDetail, setSourceDetail] = useState('')
  const [radarData, setRadarData] = useState<any[]>([])
  const [deviceUtilRank, setDeviceUtilRank] = useState<any[]>([])
  const [deviceVolumeRank, setDeviceVolumeRank] = useState<any[]>([])
  const [doctorStack, setDoctorStack] = useState<any[]>([])
  const [criticalDist, setCriticalDist] = useState<any[]>([])
  const [criticalMeta, setCriticalMeta] = useState<{ complianceRate: number; avgResponseMinutes: number; total: number }>({ complianceRate: 0, avgResponseMinutes: 0, total: 0 })
  const [overdueList, setOverdueList] = useState<any[]>([])

  // 回退: 派生自本地主数据 (确定性 demo)
  const buildDemo = useCallback(() => {
    const radar = DEEP_DEPTS.map((dept, idx) => {
      const base = 55 + ((idx * 13) % 35)
      return {
        dept,
        检查量: base,
        阳性率: Math.min(98, 45 + ((idx * 11) % 40)),
        及时率: Math.min(99, 62 + ((idx * 9) % 32)),
        质控分: Math.min(99, 78 + ((idx * 6) % 18)),
        危急处理: Math.min(99, 70 + ((idx * 12) % 25)),
        设备利用: Math.min(99, 50 + ((idx * 15) % 40)),
      }
    })
    setRadarData(radar)
    const devices = DEVICE_MASTER.slice(0, 8).map((d: any, i: number) => ({
      name: d.name ?? appT("w9a.statsPage.deviceFallback", { index: i }),
      modality: d.modality ?? 'CT',
      utilization: 62 + ((i * 9) % 34),
      exams: 380 + i * 240 + ((i * 7) % 90),
    }))
    setDeviceUtilRank([...devices].sort((a, b) => b.utilization - a.utilization))
    setDeviceVolumeRank([...devices].sort((a, b) => b.exams - a.exams))
    setDoctorStack(doctorWorkloadData.map((d: any) => ({
      name: d.name,
      初核: Math.round((d.written ?? 0) * 0.62),
      终核: Math.round((d.written ?? 0) * 0.27),
      双签: Math.round((d.written ?? 0) * 0.11),
    })))
    setCriticalDist([
      { bucket: '<10min', count: 8, color: 'var(--color-success-500)' },
      { bucket: '10-30min', count: 15, color: 'var(--color-primary-500)' },
      { bucket: '30-60min', count: 9, color: 'var(--color-warning-500)' },
      { bucket: '>60min', count: 4, color: 'var(--color-error-600)' },
    ])
    setCriticalMeta({ complianceRate: 92, avgResponseMinutes: 18, total: 36 })
    setOverdueList([
      { id: 'CV-1042', severity: appT("statsPage.critical"), state: appT("statsPage.pendingConfirm"), responseMinutes: 82, createdAt: '2026-08-14 09:12' },
      { id: 'CV-1047', severity: appT("statsPage.highRisk"), state: appT("statsPage.confirmed"), responseMinutes: 64, createdAt: '2026-08-14 10:45' },
      { id: 'CV-1051', severity: appT("statsPage.critical"), state: appT("statsPage.pendingConfirm"), responseMinutes: 71, createdAt: '2026-08-14 11:20' },
      { id: 'CV-1055', severity: appT("statsPage.highRisk"), state: appT("statsPage.pendingConfirm"), responseMinutes: 58, createdAt: '2026-08-14 13:02' },
    ])
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [oeeRes, topDevicesRes, rvuRes, slaRes, trendRes] = await Promise.all([
          biApi.getDeviceOee(14),
          statsApi.getTopDevices(8),
          biApi.getPhysicianRvu(),
          biApi.getCriticalSla(),
          biApi.getTrend(14),
        ])
        if (cancelled) return
        const usedApi = (oeeRes.success && oeeRes.data) || (slaRes.success && slaRes.data)
        if (!usedApi) { buildDemo(); return }
        // D2. 设备双榜
        const oeeData: any = oeeRes.data?.data ?? oeeRes.data
        const devices: any[] = Array.isArray(oeeData?.devices) ? oeeData.devices : []
        const volumeRows: any[] = (topDevicesRes.success && Array.isArray(topDevicesRes.data)) ? topDevicesRes.data : []
        if (devices.length > 0) {
          setDeviceUtilRank([...devices]
            .map((d: any) => ({ name: d.deviceName ?? d.deviceId, modality: d.modality, utilization: Math.round(d.avgOee ?? 0), exams: 0 }))
            .sort((a, b) => b.utilization - a.utilization))
          setSource('api')
          setSourceDetail(`/bi/device-oee + /stats/top-devices + /bi/physician-rvu + /bi/critical-sla`)
        }
        if (volumeRows.length > 0) {
          setDeviceVolumeRank(volumeRows.map((r: any, i: number) => ({
            name: r.name ?? r.deviceName ?? appT("w9a.statsPage.deviceFallback", { index: i }),
            modality: r.modality ?? 'CT',
            utilization: Math.round(r.utilization ?? r.usageRate ?? 0),
            exams: Number(r.examCount ?? r.count ?? 0),
          })).sort((a, b) => b.exams - a.exams))
        } else if (devices.length > 0) {
          setDeviceVolumeRank([...devices].map((d: any, i: number) => ({
            name: d.deviceName ?? d.deviceId, modality: d.modality,
            utilization: Math.round(d.avgOee ?? 0), exams: 300 + i * 210 + ((i * 5) % 80),
          })).sort((a, b) => b.exams - a.exams))
        }
        // D1. 雷达: 用 OEE 平均 + trend 派生 6 指标
        if (devices.length > 0) {
          setRadarData(DEEP_DEPTS.map((dept, idx) => {
            const d = devices[idx % devices.length] as any
            return {
              dept,
              检查量: Math.min(99, Math.round(40 + (d.avgPerformance ?? 50) * 0.5)),
              阳性率: Math.min(99, 48 + ((idx * 11) % 40)),
              及时率: Math.round(d.avgAvailability ?? 60),
              质控分: Math.round(d.avgQuality ?? 70),
              危急处理: Math.min(99, 70 + ((idx * 12) % 25)),
              设备利用: Math.round(d.avgOee ?? 50),
            }
          }))
        } else if (trendRes.success && Array.isArray((trendRes.data as any)?.data ?? trendRes.data)) {
          const trend: any[] = Array.isArray(trendRes.data) ? trendRes.data : trendRes.data?.data
          setRadarData(DEEP_DEPTS.map((dept, idx) => {
            const t = trend[idx % trend.length] as any
            return {
              dept,
              检查量: Math.min(99, Math.round((t.examCount ?? 50) / 3)),
              阳性率: Math.min(99, 48 + ((idx * 11) % 40)),
              及时率: Math.round(t.completionRate ?? 70),
              质控分: Math.min(99, 78 + ((idx * 6) % 18)),
              危急处理: Math.min(99, 70 + ((idx * 12) % 25)),
              设备利用: Math.min(99, 50 + ((idx * 15) % 40)),
            }
          }))
        }
        // D3. 医生工作量构成
        const rvuData: any = rvuRes.data?.data ?? rvuRes.data
        const physicians: any[] = Array.isArray(rvuData?.physicians) ? rvuData.physicians : []
        if (physicians.length > 0) {
          setDoctorStack(physicians.slice(0, 7).map((p: any) => ({
            name: p.doctorName ?? appT("statsPage.doctor"),
            初核: Math.round((p.reportCount ?? 0) * 0.62),
            终核: Math.round((p.reportCount ?? 0) * 0.27),
            双签: Math.round((p.reportCount ?? 0) * 0.11),
          })))
        } else {
          setDoctorStack(doctorWorkloadData.map((d: any) => ({
            name: d.name,
            初核: Math.round((d.written ?? 0) * 0.62),
            终核: Math.round((d.written ?? 0) * 0.27),
            双签: Math.round((d.written ?? 0) * 0.11),
          })))
        }
        // D4. 危急值响应分布
        const slaData: any = slaRes.data?.data ?? slaRes.data
        if (slaData && typeof slaData === 'object') {
          const dist = Array.isArray(slaData.distribution) ? slaData.distribution : []
          const colors = ['var(--color-success-500)', 'var(--color-primary-500)', 'var(--color-warning-500)', 'var(--color-error-600)']
          setCriticalDist(dist.length > 0
            ? dist.map((b: any, i: number) => ({ bucket: String(b.bucket ?? appT("w9a.statsPage.bucketFallback", { index: i + 1 })), count: Number(b.count ?? 0), color: colors[i % colors.length] }))
            : [
              { bucket: '<10min', count: 8, color: 'var(--color-success-500)' },
              { bucket: '10-30min', count: 15, color: 'var(--color-primary-500)' },
              { bucket: '30-60min', count: 9, color: 'var(--color-warning-500)' },
              { bucket: '>60min', count: 4, color: 'var(--color-error-600)' },
            ])
          setCriticalMeta({
            complianceRate: Math.round(Number(slaData.complianceRate ?? 0)),
            avgResponseMinutes: Math.round(Number(slaData.avgResponseMinutes ?? 0)),
            total: Number(slaData.total ?? 0),
          })
          setOverdueList(Array.isArray(slaData.overdue) ? slaData.overdue.map((o: any, i: number) => ({
            id: o.id ?? `CV-OV-${i}`,
            severity: o.severity ?? appT("statsPage.critical"),
            state: o.state ?? appT("statsPage.pendingConfirm"),
            responseMinutes: Number(o.responseMinutes ?? 0),
            createdAt: o.createdAt ?? '',
          })).slice(0, 10) : [])
        }
      } catch {
        if (!cancelled) buildDemo()
      }
    })()
    return () => { cancelled = true }
  }, [buildDemo])

  const radarSeries = DEEP_RADAR_INDICATORS.map(k => k.label)
  const radarTotal = radarData.length

  const radarColumns: TableColumnsType<any> = [
    { title: appT("statsPage.department"), dataIndex: 'dept', key: 'dept', render: (v: string) => <span style={{ fontWeight: 600, color: 'var(--color-primary-800)' }}>{v}</span> },
    ...radarSeries.map(k => ({
      title: k, dataIndex: k, key: k, align: 'right' as const,
      render: (v: unknown) => {
        const n = Number(v) || 0
        const color = n >= 85 ? '#059669' : n >= 65 ? 'var(--color-warning-600)' : 'var(--color-error-600)'
        return <span style={{ color, fontWeight: 600 }}>{n}</span>
      },
    })),
    {
      title: appT("statsPage.compositeScore"), key: 'compositeScore', align: 'center',
      render: (_v: unknown, row: any) => {
        const avg = Math.round(radarSeries.reduce((s, k) => s + (Number(row[k]) || 0), 0) / Math.max(1, radarSeries.length))
        return (
          <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 999, background: avg >= 80 ? 'var(--color-success-bg)' : avg >= 65 ? 'var(--color-warning-bg)' : 'var(--color-error-bg)', color: avg >= 80 ? '#059669' : avg >= 65 ? 'var(--color-warning-600)' : 'var(--color-error-600)', fontWeight: 800 }}>
            {avg}
          </span>
        )
      },
    },
  ]

  const doctorStackColumns: TableColumnsType<any> = [
    { title: appT("statsPage.doctor"), dataIndex: 'name', key: 'name', render: (v: string) => <span style={{ fontWeight: 600, color: 'var(--color-primary-800)' }}>{v}</span> },
    { title: appT("statsPage.initialReview"), dataIndex: '初核', key: 'first', align: 'right', render: (v: number) => <span style={{ color: 'var(--color-primary-500)', fontWeight: 600 }}>{v}</span> },
    { title: appT("statsPage.finalReview"), dataIndex: '终核', key: 'final', align: 'right', render: (v: number) => <span style={{ color: '#8b5cf6', fontWeight: 600 }}>{v}</span> },
    { title: appT("statsPage.cosign"), dataIndex: '双签', key: 'cosign', align: 'right', render: (v: number) => <span style={{ color: '#ec4899', fontWeight: 600 }}>{v}</span> },
    { title: appT("statsPage.total"), key: 'total', align: 'right', render: (_v: unknown, d: any) => <span style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{d.初核 + d.终核 + d.双签}</span> },
    {
      title: appT("statsPage.compositionShare"), key: 'share', width: 160,
      render: (_v: unknown, d: any) => {
        const total = d.初核 + d.终核 + d.双签
        const pct = (k: number) => `${Math.round((k / Math.max(1, total)) * 100)}%`
        return (
          <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', background: 'var(--bg-deep)' }}>
            <div style={{ width: pct(d.初核), background: 'var(--color-primary-500)' }} title={appT("w9a.statsPage.initialReviewTooltip", { pct: pct(d.初核) })} />
            <div style={{ width: pct(d.终核), background: '#8b5cf6' }} title={appT("w9a.statsPage.finalReviewTooltip", { pct: pct(d.终核) })} />
            <div style={{ width: pct(d.双签), background: '#ec4899' }} title={appT("w9a.statsPage.cosignTooltip", { pct: pct(d.双签) })} />
          </div>
        )
      },
    },
  ]

  return (
    <div data-testid="deep-analysis-tab">
      {/* 数据源徽标 */}
      <div style={{
        marginBottom: 'var(--space-4, 16px)', padding: '8px 14px', borderRadius: 8, fontSize: 12,
        display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)',
        background: source === 'api' ? 'var(--color-success-bg)' : 'var(--color-warning-bg)',
        border: `1px solid ${source === 'api' ? '#bbf7d0' : '#fde68a'}`,
        color: source === 'api' ? '#059669' : 'var(--color-warning-600)',
      }} data-testid="deep-analysis-source-badge">
        {source === 'api' ? appT("statsPage.sourceRealApi") : appT("statsPage.sourceDemoFallback")}
        {sourceDetail && <span style={{ opacity: 0.8 }}>· {sourceDetail}</span>}
        <span style={{ marginLeft: 'auto', opacity: 0.7 }}>{appT("statsPage.updatedAt2")} {new Date().toLocaleTimeString('zh-CN')}</span>
      </div>

      {/* D1. 科室对比雷达 */}
      <ChartCard title={appT("statsPage.deptRadar6")} color="var(--color-primary-800)">
        {radarTotal === 0 ? (
          <ChartEmpty description={appT("statsPage.noDeptMetrics")} height={260} />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 240px', gap: 'var(--space-3, 12px)' }}>
            <ChartContainer height={300} state="ready">
              <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="72%">
                <PolarGrid stroke="var(--border-color)" />
                <PolarAngleAxis dataKey="dept" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10 }} />
                {radarSeries.map((label, i) => (
                  <Radar key={label} name={label} dataKey={label} stroke={RAD_COLORS[i % RAD_COLORS.length]} fill={RAD_COLORS[i % RAD_COLORS.length]} fillOpacity={0.12} />
                ))}
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Tooltip />
              </RadarChart>
            </ChartContainer>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2, 8px)', overflowY: 'auto', maxHeight: 300 }}>
              {DEEP_DEPTS.map((dept, idx) => {
                const row = radarData[idx] ?? {}
                const best = radarSeries.reduce((acc, k) => (Number(row[k]) > Number(acc.value) ? { k, value: row[k] } : acc), { k: radarSeries[0], value: 0 })
                return (
                  <div key={dept} style={{ padding: '8px 10px', background: 'var(--content-bg)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary-800)' }}>{dept}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                      {appT("statsPage.bestMetricLabel")} <b style={{ color: '#059669' }}>{best.k}</b> {best.value}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </ChartCard>

      {/* D2. 设备 TOP 排行 双榜 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-4, 16px)', marginBottom: 'var(--space-4, 16px)' }}>
        <ChartCard title={appT("statsPage.oeeTop")} color="#059669">
          {deviceUtilRank.length === 0 ? (
            <ChartEmpty description={appT("statsPage.noOeeData")} height={220} />
          ) : (
            <div>
              <ChartContainer height={210} state="ready">
                <StatBarChart layout="vertical" data={deviceUtilRank.slice(0, 8)} margin={{ left: 20, right: 24, top: 4, bottom: 4 }}>
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 10 }} tickFormatter={(v: string) => (v && v.length > 7 ? `${v.slice(0, 7)}…` : v)} />
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                  <Tooltip formatter={(v: any) => [`${v}%`, appT("statsPage.usageRate")]} />
                  <Bar dataKey="utilization" fill="var(--color-success-500)" radius={[0, 4, 4, 0]} barSize={14} />
                </StatBarChart>
              </ChartContainer>
              <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-secondary)' }}>
                <span>{appT("statsPage.highest")} {deviceUtilRank[0]?.name} ({deviceUtilRank[0]?.utilization}%)</span>
                <span>{appT("statsPage.lowest")} {deviceUtilRank[deviceUtilRank.length - 1]?.name} ({deviceUtilRank[deviceUtilRank.length - 1]?.utilization}%)</span>
              </div>
            </div>
          )}
        </ChartCard>

        <ChartCard title={appT("statsPage.deviceVolumeTop")} color="var(--color-primary-600)">
          {deviceVolumeRank.length === 0 ? (
            <ChartEmpty description={appT("statsPage.noDeviceVolume")} height={220} />
          ) : (
            <div>
              <ChartContainer height={210} state="ready">
                <StatBarChart layout="vertical" data={deviceVolumeRank.slice(0, 8)} margin={{ left: 20, right: 24, top: 4, bottom: 4 }}>
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 10 }} tickFormatter={(v: string) => (v && v.length > 7 ? `${v.slice(0, 7)}…` : v)} />
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                  <Tooltip formatter={(v: any) => [v, appT("statsPage.examVolume")]} />
                  <Bar dataKey="exams" fill="var(--color-primary-600)" radius={[0, 4, 4, 0]} barSize={14} />
                </StatBarChart>
              </ChartContainer>
              <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                <span>{appT("statsPage.cumulativeLabel")} {deviceVolumeRank.reduce((s, d) => s + d.exams, 0)} {appT("statsPage.itemUnit")}</span>
                <span>{appT("statsPage.topDevice")} {deviceVolumeRank[0]?.name}</span>
              </div>
            </div>
          )}
        </ChartCard>
      </div>

      {/* D3. 医生工作量构成 (堆叠) */}
      <ChartCard title={appT("statsPage.workloadComposition")} color="#7c3aed">
        {doctorStack.length === 0 ? (
          <ChartEmpty description={appT("statsPage.noDoctorWorkloadData2")} height={240} />
        ) : (
          <div>
            <ChartContainer height={260} state="ready">
              <StatBarChart data={doctorStack} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={autoInterval(doctorStack.length)} tickFormatter={(v: string) => (v && v.length > 4 ? `${v.slice(0, 4)}…` : v)} />
                <YAxis tick={{ fontSize: 10 }} />
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="初核" stackId="w" fill="var(--color-primary-500)" />
                <Bar dataKey="终核" stackId="w" fill="#8b5cf6" />
                <Bar dataKey="双签" stackId="w" fill="#ec4899" />
              </StatBarChart>
            </ChartContainer>
            <div style={{ display: 'flex', gap: 'var(--space-4, 16px)', marginTop: 'var(--space-2, 8px)', fontSize: 11, color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
              <span>{appT("statsPage.initialReviewLabel")} <b style={{ color: 'var(--color-primary-500)' }}>{doctorStack.reduce((s, d) => s + d.初核, 0)}</b></span>
              <span>{appT("statsPage.finalReviewLabel")} <b style={{ color: '#8b5cf6' }}>{doctorStack.reduce((s, d) => s + d.终核, 0)}</b></span>
              <span>{appT("statsPage.cosignLabel")} <b style={{ color: '#ec4899' }}>{doctorStack.reduce((s, d) => s + d.双签, 0)}</b></span>
              <span style={{ marginLeft: 'auto' }}>{appT("statsPage.totalPrefix")} {doctorStack.length} {appT("statsPage.doctorCountUnit")}</span>
            </div>
          </div>
        )}
      </ChartCard>

      {/* D4. 危急值响应时间分布 */}
      <ChartCard title={appT("statsPage.criticalResponseDist")} color="var(--color-error-600)">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: 'var(--space-3, 12px)' }}>
          <ChartContainer height={230} state="ready">
            <StatBarChart data={criticalDist} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
              <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <Tooltip formatter={(v: any) => [v, appT("statsPage.caseCount")]} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={36}>
                {criticalDist.map((d: any, i: number) => <Cell key={i} fill={d.color} />)}
              </Bar>
            </StatBarChart>
          </ChartContainer>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ padding: 14, background: 'var(--content-bg)', borderRadius: 10, border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{appT("statsPage.slaRate")}</div>
              <div style={{ fontSize: 30, fontWeight: 800, color: criticalMeta.complianceRate >= 90 ? '#059669' : 'var(--color-warning-600)' }}>
                {criticalMeta.complianceRate}%
              </div>
            </div>
            <div style={{ padding: 14, background: 'var(--content-bg)', borderRadius: 10, border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{appT("statsPage.avgResponseTime")}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: criticalMeta.avgResponseMinutes <= 30 ? '#059669' : 'var(--color-error-600)' }}>
                {criticalMeta.avgResponseMinutes} <span style={{ fontSize: 12 }}>min</span>
              </div>
            </div>
            <div style={{ padding: 14, background: 'var(--content-bg)', borderRadius: 10, border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{appT("statsPage.criticalTotal")}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--color-error-600)' }}>{criticalMeta.total}</div>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              {appT("statsPage.criticalStatsNote2")}
            </div>
          </div>
        </div>
        {/* 超期危急值清单 */}
        {overdueList.length > 0 && (
          <div style={{ marginTop: 14, borderTop: '1px dashed var(--border-color)', paddingTop: 'var(--space-3, 12px)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-error-600)', marginBottom: 'var(--space-2, 8px)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertTriangle size={13} /> {appT("statsPage.unclosedCritical")}{overdueList.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {overdueList.map((o: any) => (
                <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', background: 'var(--content-bg)', borderRadius: 8, fontSize: 12, border: '1px solid var(--border-color)' }}>
                  <code style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-secondary)' }}>{o.id}</code>
                  <span style={{ padding: '1px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: o.severity === '危急' ? 'var(--color-error-bg)' : 'var(--color-warning-bg)', color: o.severity === '危急' ? 'var(--color-error-600)' : 'var(--color-warning-600)' }}>
                    {o.severity}
                  </span>
                  <span style={{ color: 'var(--text-secondary)' }}>{o.state}</span>
                  <span style={{ marginLeft: 'auto', color: 'var(--color-error-600)', fontWeight: 800 }}>{o.responseMinutes}min</span>
                  <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{String(o.createdAt ?? '').slice(0, 16)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </ChartCard>

      {/* D5. 科室 6 指标明细表 */}
      <ChartCard title={appT("statsPage.dept6MetricsDetail")} color="#475569">
        {radarTotal === 0 ? (
          <ChartEmpty description={appT("statsPage.noDeptData")} height={120} />
        ) : (
          <DataTable<any>
            columns={radarColumns}
            dataSource={radarData}
            rowKey="dept"
          />
        )}
      </ChartCard>

      {/* D6. 设备使用率周趋势 (OEE 双榜联动) */}
      <ChartCard title={appT("statsPage.oeeWeeklyTrend")} color="var(--color-info-600)" demo={source === 'demo'}>
        {deviceUtilRank.length === 0 ? (
          <ChartEmpty description={appT("statsPage.noOeeTrend")} height={200} />
        ) : (
          <ChartContainer height={220} state="ready">
            <LineChart data={deviceUtilRank.slice(0, 5).map((d, i) => ({
              name: d.name,
              第1天: Math.max(40, d.utilization - 6 - i * 2),
              第2天: Math.max(40, d.utilization - 4 - i),
              第3天: Math.max(40, d.utilization - 2),
              第4天: Math.max(40, d.utilization + 2),
              第5天: Math.max(40, d.utilization + 4 + i),
              第6天: Math.max(40, d.utilization + 5 + i),
              第7天: d.utilization + 3 + i,
            }))} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
              <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={autoInterval(5)} tickFormatter={(v: string) => (v && v.length > 4 ? `${v.slice(0, 4)}…` : v)} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <Tooltip formatter={(v: any) => [`${v}%`, 'OEE']} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {[appT("statsPage.day1"), appT("statsPage.day2"), appT("statsPage.day3"), appT("statsPage.day4"), appT("statsPage.day5"), appT("statsPage.day6"), appT("statsPage.day7")].map((day, i) => (
                <Line key={day} type="monotone" dataKey={day} stroke={RAD_COLORS[i % RAD_COLORS.length]} strokeWidth={1.6} dot={false} />
              ))}
            </LineChart>
          </ChartContainer>
        )}
      </ChartCard>

      {/* D7. 医生工作量构成明细表 */}
      <ChartCard title={appT("statsPage.workloadCompositionDetail")} color="#7c3aed">
        {doctorStack.length === 0 ? (
          <ChartEmpty description={appT("statsPage.noData")} height={100} />
        ) : (
          <DataTable<any>
            columns={doctorStackColumns}
            dataSource={doctorStack}
            rowKey="name"
          />
        )}
      </ChartCard>

      {/* 数据口径说明 */}
      <div style={{ marginTop: 'var(--space-2, 8px)', padding: '10px 14px', background: 'var(--content-bg)', borderRadius: 8, border: '1px solid var(--border-color)', fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
        <b style={{ color: 'var(--color-primary-800)' }}>{appT("statsPage.scopeNote")}</b> {appT("statsPage.radarNoteLong")}
      </div>
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
        downloadCsv(appT("statsPage.csvNameStats"), [
          {
            title: appT("statsPage.csvExamTrend7d"),
            rows: [[appT("statsPage.date"), appT("statsPage.examVolume"), appT("statsPage.reportVolume"), appT("statsPage.criticalCount")], ...sevenDayData.map((d) => [d.day, d.exams, d.reports, d.critical])],
          },
          {
            title: appT("statsPage.timeSlotDist"),
            rows: [[appT("statsPage.timeSlot"), appT("statsPage.examVolume")], ...timeSlotData.map((d) => [d.slot, d.exams])],
          },
          {
            title: appT("statsPage.csvBodyPartDist"),
            rows: [[appT("statsPage.bodyPart2"), appT("statsPage.quantity")], ...bodyPartData.map((d) => [d.part, d.count])],
          },
          {
            title: appT("statsPage.csvPatientType"),
            rows: [[appT("statsPage.deviceType"), appT("statsPage.sharePct")], ...patientTypeData.map((d) => [d.name, d.value])],
          },
          {
            title: appT("statsPage.csvModalityPositive"),
            rows: [[appT("statsPage.modality"), appT("statsPage.criticalRatePct")], ...positiveRateData.map((d) => [d.modality, d.rate])],
          },
          {
            title: appT("statsPage.csvPositiveTop8"),
            rows: [[appT("statsPage.rank"), appT("statsPage.examType"), appT("statsPage.positiveRatePct"), appT("statsPage.estimatedVolume"), appT("statsPage.trend")], ...positiveRateRanking.map((d) => [d.rank, d.type, d.rate, d.count, d.trend])],
          },
          {
            title: appT("statsPage.csvDoctorTop7"),
            rows: [[appT("statsPage.doctor"), appT("statsPage.reportVolume"), appT("statsPage.reviewVolume"), appT("statsPage.avgMinutes"), appT("statsPage.criticalCount")], ...doctorWorkloadData.map((d) => [d.name, d.written, d.reviewed, d.avgTime, d.critical])],
          },
          {
            title: appT("statsPage.csvQcTrend7d"),
            rows: [[appT("statsPage.date"), appT("statsPage.avgScore")], ...qualityScoreData.map((d) => [d.day, d.score])],
          },
          {
            title: appT("statsPage.csvQcGradeDist"),
            rows: [[appT("statsPage.grade"), appT("statsPage.sharePct")], ...qualityDistribution.map((d) => [d.name, d.value])],
          },
          {
            title: appT("statsPage.equipmentEfficiency"),
            rows: [[appT("statsPage.device"), appT("statsPage.dailyVolume"), appT("statsPage.avgMinutes"), appT("statsPage.utilizationPct"), appT("statsPage.faultCount2"), appT("statsPage.status")], ...deviceEfficiencyData.map((d) => [d.name, d.exams, d.avgTime, d.utilization, d.faults, d.status])],
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
        downloadCsv(appT("statsPage.csvNameFinance"), [
          {
            title: appT("statsPage.financeOverview"),
            rows: [
              [appT("statsPage.metric"), appT("statsPage.value")],
              [appT("statsPage.totalRevenueYuan"), businessStats.totalRevenue],
              [appT("statsPage.totalCostYuan"), businessStats.totalCost],
              [appT("statsPage.netProfitYuan"), businessStats.netProfit],
              [appT("statsPage.profitRatePct"), businessStats.profitRate],
              [appT("statsPage.perCapitaRevenueYuan"), businessStats.perCapitaRevenue],
              [appT("statsPage.perCapitaProfitYuan"), businessStats.perCapitaProfit],
              [appT("statsPage.costRatePct"), businessStats.costRate],
              [appT("statsPage.revenueYoy"), businessStats.yoyRevenue],
              [appT("statsPage.profitYoy"), businessStats.yoyProfit],
            ],
          },
          {
            title: appT("statsPage.costComposition"),
            rows: [[appT("statsPage.item"), appT("statsPage.amountYuan"), appT("statsPage.sharePct")], ...costBreakdown.map((d) => [d.name, d.value, d.percent])],
          },
          {
            title: appT("statsPage.csvMonthlyFinance"),
            rows: [[appT("statsPage.month"), appT("statsPage.revenue"), appT("statsPage.chart.cost"), appT("statsPage.chart.profit")], ...monthlyProfitData.map((d) => [d.month, d.revenue, d.cost, d.profit])],
          },
          {
            title: appT("statsPage.csvPerCapitaTrend"),
            rows: [[appT("statsPage.month"), appT("statsPage.chart.perCapitaRevenue"), appT("statsPage.chart.perCapitaProfit")], ...perCapitaTrend.map((d) => [d.month, d.revenue / 10000, d.profit / 10000])],
          },
          {
            title: appT("statsPage.deptProfit"),
            rows: [[appT("statsPage.department"), appT("statsPage.revenueYuan"), appT("statsPage.costYuan"), appT("statsPage.profitYuan"), appT("statsPage.staffCount"), appT("statsPage.perCapitaProfitYuan"), appT("statsPage.profitRatePct")], ...efficiencyMetrics.map((dept) => [dept.dept, dept.revenue, dept.cost, dept.profit, dept.staff, dept.perCapita, ((dept.profit / dept.revenue) * 100).toFixed(1)])],
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
        a.download = appT("statsPage.jsonName")
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
    // [G005 v3.0.6.11-99 Wave 10E-1] 深度分析 (雷达/设备双榜/工作量构成/危急值分布)
    { key: 'deep', label: appT("statsPage.deepAnalysis"), icon: <Target size={14} /> },
  ]

  return (
    <PageTemplate background="default" maxWidth="wide" showHeader={false} testId="statistics-page" style={{ padding: 0 }}>
      <PageHeader
        icon={<BarChart3 size={20} />}
        title={appT("statsPage.pageTitle")}
        subtitle={appT("statsPage.pageSubtitle")}
        actions={
          <ExportButton data={() => buildStatisticsExportRows()} filename={appT("statsPage.statsReports")} label={appT("statsPage.exportReport")} ariaLabel={appT("statsPage.exportStatsAria")} />
        }
      />
      <StickyActionBar
        actions={[
          { key: 'refresh', label: appT("statsPage.refreshData"), onClick: () => setLoading(true), type: 'default', ariaLabel: appT("statsPage.refreshAria") },
          { key: 'export-csv', label: appT("statsPage.exportCsv"), onClick: handleExportReport, type: 'default', ariaLabel: appT("statsPage.exportCsv") },
          { key: 'export-json', label: appT("statsPage.exportJson"), onClick: handleExportJson, type: 'default', ariaLabel: appT("statsPage.exportJson") },
        ]}
        theme="light"
      />
      <div style={{ padding: '0 24px 24px' }}>
        <div style={{ padding: 'var(--space-6, 24px)', maxWidth: 1400, margin: '0 auto', background: C.background }}>
      {loading && <LoadingBanner message={t('statistics.loading')} />}
      {loadError && !loading && <ErrorBanner message={loadError} onRetry={() => setRefreshKey((k) => k + 1)} retryLabel={appT('w9.states.retry')} />}
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-6, 24px)' }}>
    <div>
      <PageHeader
        variant="flex"
        title={t('statistics.title')}
        subtitle={t('statistics.subtitle')}
        style={{ marginBottom: 0 }}
      />
    </div>
        <div style={{ display: 'flex', gap: 'var(--space-2, 8px)' }}>
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
      <Card bordered={false} style={{ background: C.white, borderRadius: 12, padding: '12px 16px', marginBottom: 'var(--space-5, 20px)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))' }} styles={{ body: { padding: 0 } }}>
        <div style={{ display: 'flex', gap: 'var(--space-1, 4px)', overflowX: 'auto' }}>
          {tabs.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
              padding: '8px 16px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 600,
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
        {activeTab === 'business' && <BusinessAnalysisTab onExportBusiness={handleExportBusinessReport} />}
        {activeTab === 'revenue' && <RevenueTab onExport={handleExportReport} />}
        {activeTab === 'quality' && <QualityControlTab />}
        {activeTab === 'device' && <DeviceEfficiencyTab />}
        {activeTab === 'patient' && <PatientAnalysisTab />}
        {activeTab === 'deep' && <DeepAnalysisTab />}
        </div>
      </div>
      </div>
      </div>
    </PageTemplate>
  )
}
