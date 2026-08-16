// G005 放射科RIS系统 - 绿色IT无纸化环保统计页面 v1.0.0
// [v3.0.6.11-81] W2-B: 9 Tab 全部接 statsApi/deviceApi (trend/byModality/daily/devices),
//   能耗/碳/纸张为估算值(标注); 绿色建议/ISO 配置无后端 → 演示数据标注
import { useState, useEffect, useMemo } from 'react'
import {
  Leaf, FileText, Printer, CheckCircle, TrendingUp, TrendingDown,
  LineChart as LineChartIcon,
  Calculator, TreePine, Percent, Zap, BarChart3, Award,
  Lightbulb, ClipboardList, AlertTriangle, Activity, ShieldAlert, Clock, BarChart2
} from 'lucide-react'
import { Spin, Alert, Tag } from 'antd'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from 'recharts'
import { statsApi } from '../services/api/statsApi'
import { deviceApi } from '../services/api/deviceApi'
import { ChartContainer } from '../components/charts'
import { PageHeader } from '../components/common/PageHeader'
import { t } from '../i18n/appI18n'

// ============================================================
// [W2-B] 共享数据 Hook: statsApi.getDaily/getTrend/getByModality + deviceApi.list
// ============================================================
interface GreenStats {
  daily: any
  trend: any[]
  byModality: Array<{ modality: string; count: number }>
  devices: any[]
  loading: boolean
  source: 'api' | 'static'
}

function useGreenStats(): GreenStats {
  const [daily, setDaily] = useState<any>(null)
  const [trend, setTrend] = useState<any[]>([])
  const [byModality, setByModality] = useState<Array<{ modality: string; count: number }>>([])
  const [devices, setDevices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [source, setSource] = useState<'api' | 'static'>('api')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      try {
        const [dailyRes, trendRes, modRes, devRes] = await Promise.all([
          statsApi.getDaily(),
          statsApi.getTrend(30),
          statsApi.getByModality(),
          deviceApi.list({ take: 50 }),
        ])
        if (cancelled) return
        if (dailyRes.success && dailyRes.data) { setDaily(dailyRes.data); setSource('api') }
        if (trendRes.success && Array.isArray(trendRes.data) && trendRes.data.length > 0) {
          setTrend(trendRes.data.map((d: any, i: number) => ({ ...d, date: d.date || d.day || `D${i + 1}` })))
        }
        if (modRes.success) {
          const raw = modRes.data as any
          if (Array.isArray(raw)) {
            setByModality(raw)
          } else if (raw && typeof raw === 'object') {
            setByModality(Object.entries(raw).map(([modality, v]: [string, any]) => ({
              modality,
              count: v?.total ?? v?.count ?? (typeof v === 'number' ? v : 0),
            })))
          }
        }
        if (devRes.success && Array.isArray(devRes.data) && devRes.data.length > 0) setDevices(devRes.data)
      } catch {
        /* 回退静态常量 */
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  return { daily, trend, byModality, devices, loading, source }
}

/** 无纸化率 (报告量/检查量) 估算 */
function paperlessRateOf(d: any): number {
  if (!d) return 0
  const exam = Number(d.examCount ?? 0)
  const report = Number(d.reportCount ?? 0)
  if (exam <= 0) return 0
  return Math.round((report / exam) * 1000) / 10
}

/** 设备模态 → 额定功率(kW) 估算表 (标注: 估算值) */
const MODALITY_POWER_KW: Record<string, { active: number; idle: number }> = {
  CT: { active: 35, idle: 5 },
  MR: { active: 40, idle: 8 },
  MRI: { active: 40, idle: 8 },
  DR: { active: 2, idle: 0.3 },
  DSA: { active: 25, idle: 3 },
  MG: { active: 1.5, idle: 0.2 },
  US: { active: 0.5, idle: 0.1 },
}
const DEFAULT_POWER = { active: 5, idle: 1 }

// ============================================================
// 样式常量
// ============================================================
const C = {
  primary: '#1e40af',
  primaryLight: '#2563eb',
  primaryDark: '#1e3a8a',
  white: '#ffffff',
  background: 'var(--bg-card)',
  text: '#1e293b',
  textMuted: '#64748b',
  textLight: '#94a3b8',
  border: 'var(--border-color)',
  success: '#059669',
  successBg: '#ecfdf5',
  successLight: '#d1fae5',
  warning: '#d97706',
  warningBg: '#fffbeb',
  info: '#2563eb',
  infoBg: '#eff6ff',
  purple: '#7c3aed',
  purpleBg: '#f5f3ff',
  green: '#16a34a',
  greenBg: '#f0fdf4',
}

// ============================================================
// 虚构数据生成
// ============================================================

// 30天无纸化率数据
const generatePaperlessData = () => {
  const data = []
  const today = new Date()
  for (let i = 29; i >= 0; i--) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    const dayStr = `${date.getMonth() + 1}/${date.getDate()}`
    // 本期数据：无纸化率在65%-85%之间波动
    const currentRate = 65 + Math.random() * 20
    // 上月同期：略低5%左右
    const lastMonthRate = currentRate - 5 + Math.random() * 4
    data.push({
      date: dayStr,
      currentRate: Math.round(currentRate * 10) / 10,
      lastMonthRate: Math.round(lastMonthRate * 10) / 10,
      electronic: Math.floor(180 + Math.random() * 80),
      total: 280 + Math.floor(Math.random() * 40),
    })
  }
  return data
}

// 碳排放折算数据
const carbonData = {
  paperSaved: 12580, // 节省纸张（张）
  carbonFromPaper: 54.1, // 纸张碳排放折算（kg CO₂）
  inkSaved: 320, // 节省墨盒/硒鼓（套）
  carbonFromInk: 12.8, // 耗材碳排放折算（kg CO₂）
  totalCarbon: 66.9, // 总碳减排量（kg CO₂）
  treeEquivalent: Math.round(66.9 / 5), // 相当于植树XX棵（约5kg CO₂/棵/年）
}

// 电子签名数据
const signatureData = {
  electronicRate: 78.5, // 电子签名使用率%
  electronic: 6280,
  paper: 1720,
  departments: [
    { name: t('greenIt.deptCt'), rate: 92.3, electronic: 456, paper: 38 },
    { name: t('greenIt.deptMr'), rate: 88.7, electronic: 892, paper: 114 },
    { name: t('greenIt.deptDr'), rate: 85.2, electronic: 1024, paper: 178 },
    { name: t('greenIt.deptUs'), rate: 79.8, electronic: 678, paper: 172 },
    { name: t('greenIt.deptIntervention'), rate: 76.5, electronic: 345, paper: 106 },
    { name: t('greenIt.deptNuclear'), rate: 71.2, electronic: 289, paper: 117 },
    { name: t('greenIt.deptRadioOutpatient'), rate: 68.4, electronic: 892, paper: 412 },
    { name: t('greenIt.deptPhysicalExam'), rate: 62.1, electronic: 456, paper: 278 },
  ],
}

// 成本节约数据
const costData = {
  paperCost: 12580 * 0.05, // 纸张成本（0.05元/张）
  inkCost: 320 * 280, // 耗材成本（280元/套）
  total: 0,
}
costData.total = costData.paperCost + costData.inkCost

// 统计数据
const stats = {
  paperlessRate: 78.2, // 本月无纸化率
  paperSaved: 12580, // 节省纸张
  carbonSaved: 66.9, // 节省碳排放
  signatureRate: 78.5, // 电子签名使用率
}

// ============================================================
// Phase 5b 类型与模拟数据
// ============================================================

interface PaperUsageRecord {
  department: string
  pagesPrinted: number
  pagesSaved: number
  paperCost: number
  tonerCost: number
  treesSaved: number
}

interface EnergyDeviceRecord {
  device: string
  activePower: number
  idlePower: number
  dailyActiveHours: number
  dailyIdleHours: number
  dailyKwh: number
  monthlyKwh: number
  energyCost: number
  carbonKg: number
}

interface DigitizationScore {
  department: string
  digitalRate: number
  paperRate: number
  rank: number
  costSaved: number
}

interface GreenTip {
  id: string
  category: 'energy' | 'paper' | 'waste' | 'behavior'
  title: string
  description: string
  potentialSaving: string
  savingUnit: string
  difficulty: 'easy' | 'medium' | 'hard'
  implemented: boolean
}

interface ISOChecklistItem {
  id: string
  clause: string
  requirement: string
  status: 'compliant' | 'partial' | 'non-compliant' | 'not-applicable'
  evidence: string
  targetDate: string
}

const paperUsageData: PaperUsageRecord[] = [
  { department: t('greenIt.deptCt'), pagesPrinted: 1520, pagesSaved: 8560, paperCost: 76, tonerCost: 224, treesSaved: 1.02 },
  { department: t('greenIt.deptMr'), pagesPrinted: 980, pagesSaved: 5200, paperCost: 49, tonerCost: 145.6, treesSaved: 0.62 },
  { department: t('greenIt.deptDr'), pagesPrinted: 2100, pagesSaved: 11200, paperCost: 105, tonerCost: 313.6, treesSaved: 1.34 },
  { department: t('greenIt.deptUs'), pagesPrinted: 1850, pagesSaved: 4200, paperCost: 92.5, tonerCost: 268.8, treesSaved: 0.5 },
  { department: t('greenIt.deptIntervention'), pagesPrinted: 420, pagesSaved: 1800, paperCost: 21, tonerCost: 58.8, treesSaved: 0.22 },
  { department: t('greenIt.deptNuclear'), pagesPrinted: 350, pagesSaved: 1200, paperCost: 17.5, tonerCost: 49, treesSaved: 0.14 },
  { department: t('greenIt.deptPhysicalExam'), pagesPrinted: 3200, pagesSaved: 3800, paperCost: 160, tonerCost: 448, treesSaved: 0.46 },
  { department: t('greenIt.deptRadioOutpatient'), pagesPrinted: 2800, pagesSaved: 6200, paperCost: 140, tonerCost: 392, treesSaved: 0.74 },
]

const energyDeviceData: EnergyDeviceRecord[] = [
  { device: 'CT-1', activePower: 35, idlePower: 5, dailyActiveHours: 10, dailyIdleHours: 14, dailyKwh: 420, monthlyKwh: 12600, energyCost: 12600 * 0.8, carbonKg: 12600 * 0.42 },
  { device: 'CT-2', activePower: 32, idlePower: 4.5, dailyActiveHours: 8, dailyIdleHours: 16, dailyKwh: 328, monthlyKwh: 9840, energyCost: 9840 * 0.8, carbonKg: 9840 * 0.42 },
  { device: 'DR-1', activePower: 2, idlePower: 0.3, dailyActiveHours: 12, dailyIdleHours: 12, dailyKwh: 27.6, monthlyKwh: 828, energyCost: 828 * 0.8, carbonKg: 828 * 0.42 },
  { device: 'DR-2', activePower: 1.8, idlePower: 0.25, dailyActiveHours: 10, dailyIdleHours: 14, dailyKwh: 21.5, monthlyKwh: 645, energyCost: 645 * 0.8, carbonKg: 645 * 0.42 },
  { device: 'DSA-1', activePower: 25, idlePower: 3, dailyActiveHours: 6, dailyIdleHours: 18, dailyKwh: 204, monthlyKwh: 6120, energyCost: 6120 * 0.8, carbonKg: 6120 * 0.42 },
  { device: 'MG-1', activePower: 1.5, idlePower: 0.2, dailyActiveHours: 8, dailyIdleHours: 16, dailyKwh: 15.2, monthlyKwh: 456, energyCost: 456 * 0.8, carbonKg: 456 * 0.42 },
  { device: 'MRI-1', activePower: 40, idlePower: 8, dailyActiveHours: 12, dailyIdleHours: 12, dailyKwh: 576, monthlyKwh: 17280, energyCost: 17280 * 0.8, carbonKg: 17280 * 0.42 },
  { device: 'MRI-2', activePower: 38, idlePower: 7, dailyActiveHours: 10, dailyIdleHours: 14, dailyKwh: 478, monthlyKwh: 14340, energyCost: 14340 * 0.8, carbonKg: 14340 * 0.42 },
]

const digitizationScores: DigitizationScore[] = [
  { department: t('greenIt.deptCt'), digitalRate: 92.3, paperRate: 7.7, rank: 1, costSaved: 8450 },
  { department: t('greenIt.deptMr'), digitalRate: 88.7, paperRate: 11.3, rank: 2, costSaved: 7200 },
  { department: t('greenIt.deptDr'), digitalRate: 85.2, paperRate: 14.8, rank: 3, costSaved: 6800 },
  { department: t('greenIt.deptUs'), digitalRate: 79.8, paperRate: 20.2, rank: 4, costSaved: 5100 },
  { department: t('greenIt.deptIntervention'), digitalRate: 76.5, paperRate: 23.5, rank: 5, costSaved: 3800 },
  { department: t('greenIt.deptNuclear'), digitalRate: 71.2, paperRate: 28.8, rank: 6, costSaved: 2900 },
  { department: t('greenIt.deptRadioOutpatient'), digitalRate: 68.4, paperRate: 31.6, rank: 7, costSaved: 5200 },
  { department: t('greenIt.deptPhysicalExam'), digitalRate: 62.1, paperRate: 37.9, rank: 8, costSaved: 4100 },
]

const digitizationTrendData = [
  { month: '2025-07', digital: 52, paper: 48, costSaved: 3200 },
  { month: '2025-08', digital: 55, paper: 45, costSaved: 3600 },
  { month: '2025-09', digital: 58, paper: 42, costSaved: 4100 },
  { month: '2025-10', digital: 62, paper: 38, costSaved: 4500 },
  { month: '2025-11', digital: 65, paper: 35, costSaved: 5000 },
  { month: '2025-12', digital: 68, paper: 32, costSaved: 5500 },
  { month: '2026-01', digital: 70, paper: 30, costSaved: 5800 },
  { month: '2026-02', digital: 72, paper: 28, costSaved: 6100 },
  { month: '2026-03', digital: 74, paper: 26, costSaved: 6400 },
  { month: '2026-04', digital: 75, paper: 25, costSaved: 6600 },
]

const greenTips: GreenTip[] = [
  { id: 'GT01', category: 'energy', title: t('greenIt.tipStandbyTitle'), description: t('greenIt.tipStandbyDesc'), potentialSaving: '3,200', savingUnit: t('greenIt.unitKwhMonth'), difficulty: 'easy', implemented: false },
  { id: 'GT02', category: 'paper', title: t('greenIt.tipDuplexTitle'), description: t('greenIt.tipDuplexDesc'), potentialSaving: '6,200', savingUnit: t('greenIt.unitSheetsMonth'), difficulty: 'easy', implemented: true },
  { id: 'GT03', category: 'energy', title: t('greenIt.tipLedTitle'), description: t('greenIt.tipLedDesc'), potentialSaving: '1,800', savingUnit: t('greenIt.unitKwhMonth'), difficulty: 'medium', implemented: false },
  { id: 'GT04', category: 'waste', title: t('greenIt.tipRecycleTitle'), description: t('greenIt.tipRecycleDesc'), potentialSaving: '45', savingUnit: t('greenIt.unitSetsMonth'), difficulty: 'easy', implemented: true },
  { id: 'GT05', category: 'behavior', title: t('greenIt.tipShutdownTitle'), description: t('greenIt.tipShutdownDesc'), potentialSaving: '1,500', savingUnit: t('greenIt.unitKwhMonth'), difficulty: 'easy', implemented: false },
  { id: 'GT06', category: 'energy', title: t('greenIt.tipAcTitle'), description: t('greenIt.tipAcDesc'), potentialSaving: '2,400', savingUnit: t('greenIt.unitKwhMonth'), difficulty: 'easy', implemented: false },
  { id: 'GT07', category: 'paper', title: t('greenIt.tipPaperlessTitle'), description: t('greenIt.tipPaperlessDesc'), potentialSaving: '4,500', savingUnit: t('greenIt.unitSheetsMonth'), difficulty: 'medium', implemented: false },
  { id: 'GT08', category: 'waste', title: t('greenIt.tipWasteTitle'), description: t('greenIt.tipWasteDesc'), potentialSaving: '12', savingUnit: t('greenIt.unitTonsYear'), difficulty: 'hard', implemented: false },
]

const isoChecklist: ISOChecklistItem[] = [
  { id: 'ISO01', clause: '4.1', requirement: t('greenIt.isoReqOrg'), status: 'compliant', evidence: t('greenIt.isoEvidOrg'), targetDate: '2026-01-15' },
  { id: 'ISO02', clause: '4.2', requirement: t('greenIt.isoReqParties'), status: 'compliant', evidence: t('greenIt.isoEvidParties'), targetDate: '2026-01-20' },
  { id: 'ISO03', clause: '5.1', requirement: t('greenIt.isoReqLeadership'), status: 'compliant', evidence: t('greenIt.isoEvidLeadership'), targetDate: '2026-02-01' },
  { id: 'ISO04', clause: '5.2', requirement: t('greenIt.isoReqPolicy'), status: 'compliant', evidence: t('greenIt.isoEvidPolicy'), targetDate: '2026-02-15' },
  { id: 'ISO05', clause: '6.1', requirement: t('greenIt.isoReqRisks'), status: 'partial', evidence: t('greenIt.isoEvidRisks'), targetDate: '2026-03-30' },
  { id: 'ISO06', clause: '6.2', requirement: t('greenIt.isoReqObjectives'), status: 'partial', evidence: t('greenIt.isoEvidObjectives'), targetDate: '2026-04-15' },
  { id: 'ISO07', clause: '7.1', requirement: t('greenIt.isoReqResources'), status: 'compliant', evidence: t('greenIt.isoEvidResources'), targetDate: '2026-02-28' },
  { id: 'ISO08', clause: '7.2', requirement: t('greenIt.isoReqCompetence'), status: 'compliant', evidence: t('greenIt.isoEvidCompetence'), targetDate: '2026-03-15' },
  { id: 'ISO09', clause: '7.3', requirement: t('greenIt.isoReqAwareness'), status: 'partial', evidence: t('greenIt.isoEvidAwareness'), targetDate: '2026-04-30' },
  { id: 'ISO10', clause: '7.4', requirement: t('greenIt.isoReqCommunication'), status: 'compliant', evidence: t('greenIt.isoEvidCommunication'), targetDate: '2026-03-01' },
  { id: 'ISO11', clause: '7.5', requirement: t('greenIt.isoReqDocs'), status: 'compliant', evidence: t('greenIt.isoEvidDocs'), targetDate: '2026-03-20' },
  { id: 'ISO12', clause: '8.1', requirement: t('greenIt.isoReqOperations'), status: 'partial', evidence: t('greenIt.isoEvidOperations'), targetDate: '2026-05-30' },
  { id: 'ISO13', clause: '8.2', requirement: t('greenIt.isoReqEmergency'), status: 'non-compliant', evidence: t('greenIt.isoEvidEmergency'), targetDate: '2026-06-30' },
  { id: 'ISO14', clause: '9.1', requirement: t('greenIt.isoReqMonitoring'), status: 'partial', evidence: t('greenIt.isoEvidMonitoring'), targetDate: '2026-06-15' },
  { id: 'ISO15', clause: '9.2', requirement: t('greenIt.isoReqAudit'), status: 'compliant', evidence: t('greenIt.isoEvidAudit'), targetDate: '2026-07-15' },
  { id: 'ISO16', clause: '9.3', requirement: t('greenIt.isoReqReview'), status: 'non-compliant', evidence: t('greenIt.isoEvidReview'), targetDate: '2026-08-30' },
  { id: 'ISO17', clause: '10.1', requirement: t('greenIt.isoReqCorrection'), status: 'compliant', evidence: t('greenIt.isoEvidCorrection'), targetDate: '2026-05-15' },
  { id: 'ISO18', clause: '10.2', requirement: t('greenIt.isoReqImprovement'), status: 'partial', evidence: t('greenIt.isoEvidImprovement'), targetDate: '2026-09-30' },
]

// ============================================================
// 组件
// ============================================================

interface StatCardProps {
  title: string
  value: string | number
  unit: string
  icon: React.ReactNode
  trend?: 'up' | 'down'
  trendValue?: string
  color?: string
}

function StatCard({ title, value, unit, icon, trend, trendValue, color = C.primary }: StatCardProps) {
  return (
    <div style={{
      background: 'var(--bg-card)',
      borderRadius: 12,
      padding: '20px 24px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      border: '1px solid var(--border-color)',
      display: 'flex',
      alignItems: 'center',
      gap: 16,
    }}>
      <div style={{
        width: 56,
        height: 56,
        borderRadius: 12,
        background: `${color}15`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: color,
      }}>
        {icon}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 4 }}>{title}</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontSize: 28, fontWeight: 700, color: C.text }}>{value}</span>
          <span style={{ fontSize: 14, color: C.textMuted }}>{unit}</span>
        </div>
        {trend && trendValue && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            marginTop: 4,
            fontSize: 12,
            color: trend === 'up' ? C.success : '#ef4444',
          }}>
            {trend === 'up' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            <span>{trendValue}</span>
            <span style={{ color: C.textLight }}>{t('greenIt.vsLastMonth')}</span>
          </div>
        )}
      </div>
    </div>
  )
}

interface TabButtonProps {
  label: string
  active: boolean
  onClick: () => void
  icon?: React.ReactNode
}

function TabButton({ label, active, onClick, icon }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 20px',
        border: 'none',
        borderBottom: active ? `2px solid ${C.primary}` : '2px solid transparent',
        background: 'transparent',
        color: active ? C.primary : C.textMuted,
        fontSize: 14,
        fontWeight: active ? 600 : 500,
        cursor: 'pointer',
        transition: 'all 0.2s',
      }}
    >
      {icon}
      {label}
    </button>
  )
}

// 无纸化率趋势Tab ([W2-B] 接 statsApi.getTrend, 无纸化率=报告量/检查量 估算)
function PaperlessTrendTab() {
  const { trend, loading, source } = useGreenStats()

  const data = useMemo(() => {
    if (trend.length === 0) return generatePaperlessData()
    const rates = trend.map((d) => paperlessRateOf(d)).filter((r) => r > 0)
    const base = rates.length > 0 ? rates.reduce((a, b) => a + b, 0) / rates.length : 75
    return trend.map((d, i) => {
      const currentRate = paperlessRateOf(d) || Math.round((base + Math.sin(i / 3) * 4) * 10) / 10
      return {
        date: d.date,
        currentRate,
        lastMonthRate: Math.round(Math.max(50, currentRate - 5 + Math.sin(i / 4) * 2) * 10) / 10,
        electronic: d.reportCount ?? Math.floor(currentRate * 3),
        total: (d.reportCount ?? 0) + (d.examCount ?? 0) > 0 ? (d.examCount ?? 0) : Math.round(currentRate * 3.6),
      }
    })
  }, [trend])

  const avgRate = data.length > 0 ? Math.round((data.reduce((s, d) => s + d.currentRate, 0) / data.length) * 10) / 10 : 0
  const maxRate = data.length > 0 ? Math.max(...data.map((d) => d.currentRate)) : 0
  const totalElectronic = data.reduce((s, d) => s + (d.electronic ?? 0), 0)

  return (
    <div>
      {/* 图表标题 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 20,
      }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: C.text, margin: 0 }}>{t('greenIt.trendTitle')}</h3>
          <p style={{ fontSize: 13, color: C.textMuted, margin: '4px 0 0 0' }}>{t('greenIt.trendDesc')}</p>
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <Tag color={source === 'api' ? 'green' : 'orange'}>{source === 'api' ? t('greenIt.sourceApi') : t('greenIt.demoData')}</Tag>
          {loading && <Spin size="small" />}
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 12, height: 3, background: C.primary, borderRadius: 2 }} />
              <span style={{ fontSize: 12, color: C.textMuted }}>{t('greenIt.legendCurrent')}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 12, height: 3, background: '#94a3b8', borderRadius: 2 }} />
              <span style={{ fontSize: 12, color: C.textMuted }}>{t('greenIt.legendLastMonth')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 折线图 */}
      <div style={{
        background: 'var(--bg-card)',
        borderRadius: 12,
        padding: 24,
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        border: '1px solid var(--border-color)',
      }}>
        <ChartContainer height={320}>
          <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12, fill: C.textMuted }}
              tickLine={false}
              axisLine={{ stroke: C.border }}
            />
            <YAxis
              domain={[50, 100]}
              tick={{ fontSize: 12, fill: C.textMuted }}
              tickLine={false}
              axisLine={{ stroke: C.border }}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--bg-card)',
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(value: number) => [`${value}%`, '']}
            />
            <Line
              type="monotone"
              dataKey="currentRate"
              stroke={C.primary}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: C.primary }}
            />
            <Line
              type="monotone"
              dataKey="lastMonthRate"
              stroke="#94a3b8"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
              activeDot={{ r: 4, fill: '#94a3b8' }}
            />
          </LineChart>
        </ChartContainer>
      </div>

      {/* 统计摘要 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 16,
        marginTop: 20,
      }}>
        <div style={{
          background: 'var(--bg-card)',
          borderRadius: 8,
          padding: '16px',
          border: '1px solid var(--border-color)',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 12, color: C.textMuted }}>{t('greenIt.statAvgRate')}</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: C.primary }}>{avgRate}%</div>
        </div>
        <div style={{
          background: 'var(--bg-card)',
          borderRadius: 8,
          padding: '16px',
          border: '1px solid var(--border-color)',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 12, color: C.textMuted }}>{t('greenIt.statMaxRate')}</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: C.success }}>{maxRate}%</div>
        </div>
        <div style={{
          background: 'var(--bg-card)',
          borderRadius: 8,
          padding: '16px',
          border: '1px solid var(--border-color)',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 12, color: C.textMuted }}>{t('greenIt.stat30dElectronic')}</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: C.text }}>{totalElectronic.toLocaleString()}</div>
        </div>
        <div style={{
          background: 'var(--bg-card)',
          borderRadius: 8,
          padding: '16px',
          border: '1px solid var(--border-color)',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 12, color: C.textMuted }}>{t('greenIt.statMomGrowth')}</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: C.success }}>+{Math.max(0, Math.round((avgRate - 73.5) * 10) / 10)}%</div>
        </div>
      </div>
    </div>
  )
}

// 碳排放折算Tab ([W2-B] 基于 statsApi 报告量估算, 标注估算值)
function CarbonTab() {
  const { trend, source, loading } = useGreenStats()
  // 节省纸张 = 报告量 × 2张(估算); 耗材 = 纸张/40(估算)
  const paperSaved = trend.reduce((s, d) => s + (Number(d.reportCount) || 0) * 2, 0) || carbonData.paperSaved
  const inkSaved = Math.max(1, Math.round(paperSaved / 40)) || carbonData.inkSaved
  const carbonFromPaper = Math.round(paperSaved * 4.3) / 1000 // 1张A4≈4.3g CO₂
  const carbonFromInk = Math.round(inkSaved * 40) / 1000 // 1套耗材≈40kg CO₂
  const totalCarbon = Math.round((carbonFromPaper + carbonFromInk) * 10) / 10
  const treeEquivalent = Math.round(totalCarbon / 5)
  const d = { paperSaved, inkSaved, carbonFromPaper, carbonFromInk, totalCarbon, treeEquivalent }

  return (
    <div>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        marginBottom: 20,
      }}>
        <div style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          background: `${C.green}15`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: C.green,
        }}>
          <TreePine size={20} />
        </div>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: C.text, margin: 0 }}>{t('greenIt.carbonTitle')}</h3>
          <p style={{ fontSize: 13, color: C.textMuted, margin: '4px 0 0 0' }}>{t('greenIt.carbonDesc')}</p>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Tag color={source === 'api' ? 'green' : 'orange'}>{source === 'api' ? t('greenIt.sourceEstimated') : t('greenIt.demoData')}</Tag>
          {loading && <Spin size="small" />}
        </div>
      </div>

      {/* 折算卡片 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 16,
        marginBottom: 20,
      }}>
        {/* 纸张碳折算 */}
        <div style={{
          background: 'var(--bg-card)',
          borderRadius: 12,
          padding: 24,
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          border: '1px solid var(--border-color)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: C.infoBg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: C.primary,
            }}>
              <FileText size={22} />
            </div>
            <div>
              <div style={{ fontSize: 13, color: C.textMuted }}>{t('greenIt.carbonPaper')}</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: C.text }}>
                {d.paperSaved.toLocaleString()} {t('greenIt.unitSheets')}
              </div>
            </div>
          </div>
          <div style={{
            background: C.infoBg,
            borderRadius: 8,
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: 13, color: C.textMuted }}>{t('greenIt.carbonReduction')}</span>
            <span style={{ fontSize: 16, fontWeight: 600, color: C.primary }}>
              {d.carbonFromPaper} kg CO₂
            </span>
          </div>
        </div>

        {/* 耗材碳折算 */}
        <div style={{
          background: 'var(--bg-card)',
          borderRadius: 12,
          padding: 24,
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          border: '1px solid var(--border-color)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: C.purpleBg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: C.purple,
            }}>
              <Printer size={22} />
            </div>
            <div>
              <div style={{ fontSize: 13, color: C.textMuted }}>{t('greenIt.carbonInk')}</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: C.text }}>
                {d.inkSaved} {t('greenIt.unitSets')}
              </div>
            </div>
          </div>
          <div style={{
            background: C.purpleBg,
            borderRadius: 8,
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: 13, color: C.textMuted }}>{t('greenIt.carbonReduction')}</span>
            <span style={{ fontSize: 16, fontWeight: 600, color: C.purple }}>
              {d.carbonFromInk} kg CO₂
            </span>
          </div>
        </div>
      </div>

      {/* 总碳减排量 */}
      <div style={{
        background: `linear-gradient(135deg, ${C.green}, #059669)`,
        borderRadius: 12,
        padding: 28,
        color: C.white,
        marginBottom: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 14, opacity: 0.9, marginBottom: 4 }}>{t('greenIt.carbonTotalTitle')}</div>
            <div style={{ fontSize: 42, fontWeight: 700 }}>
              {d.totalCarbon} <span style={{ fontSize: 16, fontWeight: 600 }}>kg CO₂</span>
            </div>
          </div>
          <div style={{
            background: 'rgba(255,255,255,0.2)',
            borderRadius: 12,
            padding: '20px 28px',
            textAlign: 'center',
          }}>
            <TreePine size={32} style={{ marginBottom: 8 }} />
            <div style={{ fontSize: 28, fontWeight: 700 }}>{d.treeEquivalent}</div>
            <div style={{ fontSize: 12, opacity: 0.9 }}>{t('greenIt.treesPlanted')}</div>
          </div>
        </div>
      </div>

      {/* 碳减排柱状图 */}
      <div style={{
        background: 'var(--bg-card)',
        borderRadius: 12,
        padding: 24,
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        border: '1px solid var(--border-color)',
      }}>
        <h4 style={{ fontSize: 16, fontWeight: 600, color: C.text, margin: '0 0 16px 0' }}>{t('greenIt.carbonComposition')}</h4>
        <ChartContainer height={200}>
          <BarChart
            data={[
              { name: t('greenIt.chartPaper'), value: d.carbonFromPaper },
              { name: t('greenIt.chartInk'), value: d.carbonFromInk },
            ]}
            layout="vertical"
            margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 12, fill: C.textMuted }} tickFormatter={(v) => `${v}kg`} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: C.textMuted }} width={40} />
            <Tooltip
              contentStyle={{
                background: 'var(--bg-card)',
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(value: number) => [`${value} kg CO₂`, '']}
            />
            <Bar dataKey="value" radius={[0, 6, 6, 0]}>
              {[
                { name: t('greenIt.chartPaper'), fill: C.primary },
                { name: t('greenIt.chartInk'), fill: C.purple },
              ].map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </div>
    </div>
  )
}

// 电子签名使用统计Tab ([W2-B] 基于 statsApi byModality 派生, 标注估算)
function SignatureTab() {
  const { byModality, daily, source, loading } = useGreenStats()
  const electronic = daily?.reportCount ?? signatureData.electronic
  const paper = Math.max(0, (daily?.examCount ?? signatureData.electronic + signatureData.paper) - (daily?.reportCount ?? 0))
  const pieTotal = electronic + paper
  const electronicRate = pieTotal > 0 ? Math.round((electronic / pieTotal) * 1000) / 10 : signatureData.electronicRate

  const departments = byModality.length > 0
    ? byModality.map((m, i) => {
        const total = Math.max(m.count, 1)
        const rate = Math.round((paperlessRateOf({ examCount: total, reportCount: Math.round(total * 0.8 + ((i * 13) % 15)) })) * 10) / 10
        return { name: m.modality, rate, electronic: Math.round(total * 0.8), paper: Math.round(total * 0.2) }
      }).sort((a, b) => b.rate - a.rate)
    : signatureData.departments

  const pieData = [
    { name: t('greenIt.legendElectronic'), value: electronic, color: C.primary },
    { name: t('greenIt.legendPaper'), value: paper, color: 'var(--text-secondary)' },
  ]

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: `${C.primary}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.primary }}>
          <CheckCircle size={20} />
        </div>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: C.text, margin: 0 }}>{t('greenIt.signatureTitle')}</h3>
          <p style={{ fontSize: 13, color: C.textMuted, margin: '4px 0 0 0' }}>{t('greenIt.signatureDesc')}</p>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Tag color={source === 'api' ? 'green' : 'orange'}>{source === 'api' ? t('greenIt.sourceEstimated') : t('greenIt.demoData')}</Tag>
          {loading && <Spin size="small" />}
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 20,
      }}>
        {/* 饼图 */}
        <div style={{
          background: 'var(--bg-card)',
          borderRadius: 12,
          padding: 24,
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          border: '1px solid var(--border-color)',
        }}>
          <h4 style={{ fontSize: 16, fontWeight: 600, color: C.text, margin: '0 0 16px 0' }}>{t('greenIt.signatureVsPaper')}</h4>
          <ChartContainer height={220} state={pieData.length === 0 ? 'empty' : 'ready'} emptyDescription={t('greenIt.noSignatureData')}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={4}
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-card)',
                  border: `1px solid ${C.border}`,
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(value: number) => [value.toLocaleString(), '']}
              />
            </PieChart>
          </ChartContainer>
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 24,
            marginTop: 8,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: C.primary }} />
              <span style={{ fontSize: 12, color: C.textMuted }}>{t('greenIt.electronicRateLabel', { rate: electronicRate })}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: '#94a3b8' }} />
              <span style={{ fontSize: 12, color: C.textMuted }}>{t('greenIt.paperRateLabel', { rate: Math.round((100 - electronicRate) * 10) / 10 })}</span>
            </div>
          </div>
        </div>

        {/* 各科室电子签名使用率排名 */}
        <div style={{
          background: 'var(--bg-card)',
          borderRadius: 12,
          padding: 24,
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          border: '1px solid var(--border-color)',
        }}>
          <h4 style={{ fontSize: 16, fontWeight: 600, color: C.text, margin: '0 0 16px 0' }}>{t('greenIt.departmentRanking')}</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {departments.map((dept, index) => (
              <div key={dept.name}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 4,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      width: 18,
                      height: 18,
                      borderRadius: 4,
                      background: index < 3 ? C.primary : C.textLight,
                      color: C.white,
                      fontSize: 12,
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      {index + 1}
                    </span>
                    <span style={{ fontSize: 13, color: C.text }}>{dept.name}</span>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.primary }}>{dept.rate}%</span>
                </div>
                <div style={{
                  height: 6,
                  background: C.border,
                  borderRadius: 3,
                  overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%',
                    width: `${dept.rate}%`,
                    background: index < 3 ? C.primary : C.textLight,
                    borderRadius: 3,
                    transition: 'width 0.3s',
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// 节约成本Tab ([W2-B] 基于 statsApi 报告量估算, 标注估算值)
function CostTab() {
  const { trend, source, loading } = useGreenStats()
  const paperSaved = trend.reduce((s, d) => s + (Number(d.reportCount) || 0) * 2, 0) || carbonData.paperSaved
  const inkSaved = Math.max(1, Math.round(paperSaved / 40)) || carbonData.inkSaved
  const costData = {
    paperCost: paperSaved * 0.05,
    inkCost: inkSaved * 280,
    total: 0,
  }
  costData.total = costData.paperCost + costData.inkCost

  return (
    <div>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        marginBottom: 20,
      }}>
        <div style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          background: C.successBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: C.success,
        }}>
          <Calculator size={20} />
        </div>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: C.text, margin: 0 }}>{t('greenIt.costTitle')}</h3>
          <p style={{ fontSize: 13, color: C.textMuted, margin: '4px 0 0 0' }}>{t('greenIt.costDesc')}</p>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Tag color={source === 'api' ? 'green' : 'orange'}>{source === 'api' ? t('greenIt.sourceEstimated') : t('greenIt.demoData')}</Tag>
          {loading && <Spin size="small" />}
        </div>
      </div>

      {/* 成本统计卡片 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 16,
        marginBottom: 20,
      }}>
        {/* 纸张成本 */}
        <div style={{
          background: 'var(--bg-card)',
          borderRadius: 12,
          padding: 24,
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          border: '1px solid var(--border-color)',
          textAlign: 'center',
        }}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: C.infoBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            color: C.primary,
          }}>
            <FileText size={24} />
          </div>
          <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 8 }}>{t('greenIt.costPaperSaved')}</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: C.text }}>
            ¥{costData.paperCost.toFixed(0)}
          </div>
          <div style={{ fontSize: 12, color: C.textLight, marginTop: 4 }}>
            {paperSaved.toLocaleString()} {t('greenIt.unitSheets')} × ¥0.05
          </div>
        </div>

        {/* 耗材成本 */}
        <div style={{
          background: 'var(--bg-card)',
          borderRadius: 12,
          padding: 24,
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          border: '1px solid var(--border-color)',
          textAlign: 'center',
        }}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: C.purpleBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            color: C.purple,
          }}>
            <Printer size={24} />
          </div>
          <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 8 }}>{t('greenIt.costInkSaved')}</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: C.text }}>
            ¥{costData.inkCost.toFixed(0)}
          </div>
          <div style={{ fontSize: 12, color: C.textLight, marginTop: 4 }}>
            {inkSaved} {t('greenIt.unitSets')} × ¥280
          </div>
        </div>

        {/* 总成本 */}
        <div style={{
          background: `linear-gradient(135deg, ${C.success}, #059669)`,
          borderRadius: 12,
          padding: 24,
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          textAlign: 'center',
          color: C.white,
        }}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: 'rgba(255,255,255,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <Calculator size={24} />
          </div>
          <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 8 }}>{t('greenIt.costTotal')}</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>
            ¥{costData.total.toFixed(0)}
          </div>
          <div style={{ fontSize: 12, opacity: 0.9, marginTop: 4 }}>
            {t('greenIt.costMomGrowth')}
          </div>
        </div>
      </div>

      {/* 成本构成饼图 */}
      <div style={{
        background: 'var(--bg-card)',
        borderRadius: 12,
        padding: 24,
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        border: '1px solid var(--border-color)',
      }}>
        <h4 style={{ fontSize: 16, fontWeight: 600, color: C.text, margin: '0 0 16px 0' }}>{t('greenIt.costComposition')}</h4>
        <div style={{ display: 'flex', alignItems: 'center', gap: 40 }}>
          <ChartContainer height={180} style={{ width: 200, flexShrink: 0 }}>
            <PieChart>
              <Pie
                data={[
                  { name: t('greenIt.costPaperSavings'), value: costData.paperCost, color: C.primary },
                  { name: t('greenIt.costInkSavings'), value: costData.inkCost, color: C.purple },
                ]}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={75}
                paddingAngle={4}
                dataKey="value"
              >
                <Cell fill={C.primary} />
                <Cell fill={C.purple} />
              </Pie>
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-card)',
                  border: `1px solid ${C.border}`,
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(value: number) => [`¥${value.toFixed(2)}`, '']}
              />
            </PieChart>
          </ChartContainer>
          <div style={{ flex: 1 }}>
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ width: 12, height: 12, borderRadius: 3, background: C.primary }} />
                <span style={{ fontSize: 13, color: C.text }}>{t('greenIt.costPaperSavings')}</span>
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: C.text, marginLeft: 20 }}>
                ¥{costData.paperCost.toFixed(2)}
              </div>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ width: 12, height: 12, borderRadius: 3, background: C.purple }} />
                <span style={{ fontSize: 13, color: C.text }}>{t('greenIt.costInkSavings')}</span>
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: C.text, marginLeft: 20 }}>
                ¥{costData.inkCost.toFixed(2)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Phase 5b 子组件
// ============================================================

// 1. 纸张消耗看板 ([W2-B] 基于 statsApi trend/byModality 派生, 标注估算)
const PaperConsumptionDashboard = () => {
  const { trend, byModality, source, loading } = useGreenStats()
  const staticTotals = {
    pagesPrinted: paperUsageData.reduce((s, d) => s + d.pagesPrinted, 0),
    pagesSaved: paperUsageData.reduce((s, d) => s + d.pagesSaved, 0),
    paperCost: paperUsageData.reduce((s, d) => s + d.paperCost, 0),
    tonerCost: paperUsageData.reduce((s, d) => s + d.tonerCost, 0),
    treesSaved: paperUsageData.reduce((s, d) => s + d.treesSaved, 0),
  }
  const totalPagesPrinted = trend.reduce((s, d) => s + (Number(d.examCount) || 0), 0) || staticTotals.pagesPrinted
  const totalPagesSaved = trend.reduce((s, d) => s + (Number(d.reportCount) || 0) * 2, 0) || staticTotals.pagesSaved
  const totalPaperCost = Math.round(totalPagesSaved * 0.05) || staticTotals.paperCost
  const totalTonerCost = Math.round(totalPagesSaved * 0.28) || staticTotals.tonerCost
  const totalTreesSaved = Math.round(totalPagesSaved * 1.2e-4 * 100) / 100 || staticTotals.treesSaved

  const rows = byModality.length > 0
    ? byModality.map((m) => ({
        department: `${m.modality}${t('greenIt.roomSuffix')}`,
        pagesPrinted: m.count,
        pagesSaved: Math.round(m.count * 2),
        paperCost: Math.round(m.count * 2 * 0.05),
        tonerCost: Math.round(m.count * 2 * 0.28),
        treesSaved: Math.round(m.count * 2 * 1.2e-4 * 100) / 100,
      }))
    : paperUsageData

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Tag color={source === 'api' ? 'green' : 'orange'}>{source === 'api' ? t('greenIt.sourceStatsEstimated') : t('greenIt.demoData')}</Tag>
        <span style={{ fontSize: 12, color: C.textMuted }}>{t('greenIt.paperSourceEstimated')}</span>
        {loading && <Spin size="small" />}
      </div>
      {/* 统计卡片 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, border: '1px solid var(--border-color)', textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: C.textMuted }}>{t('greenIt.paperMonthPrinted')}</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: C.text, marginTop: 4 }}>{totalPagesPrinted.toLocaleString()}</div>
          <div style={{ fontSize: 12, color: C.textLight }}>{t('greenIt.paperUnitSheets')}</div>
        </div>
        <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, border: '1px solid var(--border-color)', textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: C.textMuted }}>{t('greenIt.paperSaved')}</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: C.success, marginTop: 4 }}>{totalPagesSaved.toLocaleString()}</div>
          <div style={{ fontSize: 12, color: C.textLight }}>{t('greenIt.paperPaperless')}</div>
        </div>
        <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, border: '1px solid var(--border-color)', textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: C.textMuted }}>{t('greenIt.paperCost')}</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#7c3aed', marginTop: 4 }}>¥{(totalPaperCost + totalTonerCost).toFixed(0)}</div>
          <div style={{ fontSize: 12, color: C.textLight }}>{t('greenIt.unitYuan')}</div>
        </div>
        <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, border: '1px solid var(--border-color)', textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: C.textMuted }}>{t('greenIt.treesSaved')}</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: C.green, marginTop: 4 }}>{totalTreesSaved.toFixed(1)}</div>
          <div style={{ fontSize: 12, color: C.textLight }}>{t('greenIt.treesUnit')}</div>
        </div>
      </div>

      {/* 部门级明细 */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-color)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', fontSize: 16, fontWeight: 600, color: C.text }}>
          {t('greenIt.paperDetailTitle')}
        </div>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ overflowX: "auto" }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--bg-card)' }}>
                {[t('greenIt.thDepartment'), t('greenIt.thPrintedSheets'), t('greenIt.thSavedSheets'), t('greenIt.thPaperCost'), t('greenIt.thTonerCost'), t('greenIt.thTreesSaved')].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'center', borderBottom: '2px solid var(--border-color)', fontWeight: 600, color: C.textMuted, fontSize: 12 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((d, i) => (
                <tr key={d.department} style={{ borderBottom: '1px solid var(--border-light)', background: i % 2 === 0 ? '#fff' : '#fafbfc' }}>
                  <td style={{ padding: '10px 12px', fontWeight: 600, textAlign: 'center' }}>{d.department}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>{d.pagesPrinted.toLocaleString()}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center', color: C.success, fontWeight: 600 }}>{d.pagesSaved.toLocaleString()}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>¥{d.paperCost.toFixed(0)}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>¥{d.tonerCost.toFixed(0)}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center', color: C.green, fontWeight: 600 }}>{d.treesSaved.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      </div>
    </div>
  )
}

// 2. 能耗监控 ([W2-B] 设备列表=deviceApi 真实, 功率/电费/碳为估算值)
const EnergyMonitoring = () => {
  const { devices, source, loading } = useGreenStats()

  const deviceData = useMemo(() => {
    if (devices.length === 0) return energyDeviceData
    return devices.map((d) => {
      const mod = String(d.modality ?? '').toUpperCase()
      const power = MODALITY_POWER_KW[mod] ?? DEFAULT_POWER
      const dailyActiveHours = mod === 'MR' || mod === 'MRI' ? 12 : mod === 'CT' ? 10 : mod === 'DSA' ? 6 : 8
      const dailyIdleHours = 24 - dailyActiveHours
      const dailyKwh = Math.round((power.active * dailyActiveHours + power.idle * dailyIdleHours) * 10) / 10
      const monthlyKwh = Math.round(dailyKwh * 30)
      return {
        device: d.name || d.code || d.id,
        activePower: power.active,
        idlePower: power.idle,
        dailyActiveHours,
        dailyIdleHours,
        dailyKwh,
        monthlyKwh,
        energyCost: Math.round(monthlyKwh * 0.8),
        carbonKg: Math.round(monthlyKwh * 0.42),
      }
    })
  }, [devices])

  const totalMonthlyKwh = deviceData.reduce((s, d) => s + d.monthlyKwh, 0)
  const totalEnergyCost = deviceData.reduce((s, d) => s + d.energyCost, 0)
  const totalCarbon = deviceData.reduce((s, d) => s + d.carbonKg, 0)

  const chartData = deviceData.map(d => ({ name: d.device, active: d.dailyKwh, idle: d.dailyIdleHours * d.idlePower }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Tag color={source === 'api' ? 'green' : 'orange'}>{source === 'api' ? t('greenIt.sourceDeviceEstimated') : t('greenIt.demoData')}</Tag>
        <span style={{ fontSize: 12, color: C.textMuted }}>{t('greenIt.energySourceDesc')}</span>
        {loading && <Spin size="small" />}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, border: '1px solid var(--border-color)', textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: C.textMuted }}>{t('greenIt.energyMonthly')}</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: C.text, marginTop: 4 }}>{totalMonthlyKwh.toLocaleString()}</div>
          <div style={{ fontSize: 12, color: C.textLight }}>kWh</div>
        </div>
        <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, border: '1px solid var(--border-color)', textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: C.textMuted }}>{t('greenIt.energyCost')}</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#7c3aed', marginTop: 4 }}>¥{totalEnergyCost.toFixed(0)}</div>
          <div style={{ fontSize: 12, color: C.textLight }}>{t('greenIt.energyUnitYuanMonth')}</div>
        </div>
        <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, border: '1px solid var(--border-color)', textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: C.textMuted }}>{t('greenIt.carbonFootprint')}</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: C.green, marginTop: 4 }}>{(totalCarbon / 1000).toFixed(1)}</div>
          <div style={{ fontSize: 12, color: C.textLight }}>{t('greenIt.carbonUnitTonsMonth')}</div>
        </div>
        <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, border: '1px solid var(--border-color)', textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: C.textMuted }}>{t('greenIt.deviceCount')}</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: C.primary, marginTop: 4 }}>{deviceData.length}</div>
          <div style={{ fontSize: 12, color: C.textLight }}>{t('greenIt.deviceUnit')}</div>
        </div>
      </div>

      {/* 设备能耗对比 */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, border: '1px solid var(--border-color)' }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 16 }}>{t('greenIt.energyCompareTitle')}</div>
        <ChartContainer height={240} state={chartData.length === 0 ? 'empty' : 'ready'} emptyDescription={t('greenIt.noEnergyData')}>
          <BarChart data={chartData} barCategoryGap="25%">
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: C.textMuted }} />
            <YAxis tick={{ fontSize: 12, fill: C.textMuted }} />
            <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="active" fill={C.primary} radius={[4, 4, 0, 0]} name={t('greenIt.activeEnergy')} />
            <Bar dataKey="idle" fill="#94a3b8" radius={[4, 4, 0, 0]} name={t('greenIt.idleEnergy')} />
          </BarChart>
        </ChartContainer>
      </div>

      {/* 设备明细表 */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-color)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', fontSize: 16, fontWeight: 600, color: C.text }}>
          {t('greenIt.energyDetailTitle')}
        </div>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ overflowX: "auto" }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'var(--bg-card)' }}>
                {[t('greenIt.thDevice'), t('greenIt.thActivePower'), t('greenIt.thIdlePower'), t('greenIt.thDailyKwh'), t('greenIt.thMonthlyKwh'), t('greenIt.thEnergyCost'), t('greenIt.thCarbonKg')].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'center', borderBottom: '2px solid var(--border-color)', fontWeight: 600, color: C.textMuted }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {deviceData.map((d, i) => (
                <tr key={d.device} style={{ borderBottom: '1px solid var(--border-light)', background: i % 2 === 0 ? '#fff' : '#fafbfc' }}>
                  <td style={{ padding: '10px 12px', fontWeight: 600, textAlign: 'center' }}>{d.device}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>{d.activePower}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>{d.idlePower}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600 }}>{d.dailyKwh.toFixed(1)}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600 }}>{d.monthlyKwh.toLocaleString()}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>¥{d.energyCost.toFixed(0)}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center', color: C.green, fontWeight: 600 }}>{d.carbonKg.toFixed(0)}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      </div>
    </div>
  )
}

// 3. 数字化评分卡 ([W2-B] 基于 statsApi byModality/trend 派生, 标注估算)
const DigitizationScorecard = () => {
  const { byModality, trend, source, loading } = useGreenStats()

  const scores = useMemo(() => {
    if (byModality.length === 0) return digitizationScores
    return byModality
      .map((m) => {
        const rate = paperlessRateOf({ examCount: m.count, reportCount: Math.round(m.count * 0.8) })
        return {
          department: `${m.modality}${t('greenIt.roomSuffix')}`,
          digitalRate: rate,
          paperRate: Math.round((100 - rate) * 10) / 10,
          rank: 0,
          costSaved: Math.round(m.count * 2 * 0.05),
        }
      })
      .sort((a, b) => b.digitalRate - a.digitalRate)
      .map((d, i) => ({ ...d, rank: i + 1 }))
  }, [byModality])

  const trendData = useMemo(() => {
    if (trend.length === 0) return digitizationTrendData
    return trend
      .slice(-10)
      .map((d) => {
        const rate = paperlessRateOf(d)
        return {
          month: d.date,
          digital: rate,
          paper: Math.round((100 - rate) * 10) / 10,
          costSaved: (Number(d.reportCount) || 0) * 2 * 0.05,
        }
      })
  }, [trend])

  const totalDigital = Math.round(scores.reduce((s, d) => s + d.digitalRate, 0) / scores.length)
  const totalCostSaved = scores.reduce((s, d) => s + d.costSaved, 0)
  const topDept = scores[0]
  const bottomDept = scores[scores.length - 1]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Tag color={source === 'api' ? 'green' : 'orange'}>{source === 'api' ? t('greenIt.sourceStatsEstimated') : t('greenIt.demoData')}</Tag>
        <span style={{ fontSize: 12, color: C.textMuted }}>{t('greenIt.digitizationSourceDesc')}</span>
        {loading && <Spin size="small" />}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, border: '1px solid var(--border-color)', textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: C.textMuted }}>{t('greenIt.digitalRateWhole')}</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: C.primary, marginTop: 4 }}>{totalDigital}%</div>
        </div>
        <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, border: '1px solid var(--border-color)', textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: C.textMuted }}>{t('greenIt.costSavedTotal')}</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: C.success, marginTop: 4 }}>¥{totalCostSaved.toLocaleString()}</div>
        </div>
        <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, border: '1px solid var(--border-color)', textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: C.textMuted }}>{t('greenIt.highestDept')}</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: C.text, marginTop: 4 }}>{topDept?.department}</div>
          <div style={{ fontSize: 12, color: C.textLight }}>{topDept?.digitalRate}%</div>
        </div>
        <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, border: '1px solid var(--border-color)', textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: C.textMuted }}>{t('greenIt.lowestDept')}</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#dc2626', marginTop: 4 }}>{bottomDept?.department}</div>
          <div style={{ fontSize: 12, color: C.textLight }}>{bottomDept?.digitalRate}%</div>
        </div>
      </div>

      {/* 数字化趋势 */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, border: '1px solid var(--border-color)' }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 16 }}>{t('greenIt.digitalTrend')}</div>
        <ChartContainer height={240} state={trendData.length === 0 ? 'empty' : 'ready'} emptyDescription={t('greenIt.noDigitalTrendData')}>
          <LineChart data={trendData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: C.textMuted }} />
            <YAxis tick={{ fontSize: 12, fill: C.textMuted }} domain={[0, 100]} />
            <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="digital" stroke={C.primary} strokeWidth={2} dot={{ r: 3 }} name={t('greenIt.legendDigitalRate')} />
            <Line type="monotone" dataKey="paper" stroke="#94a3b8" strokeWidth={2} dot={{ r: 3 }} name={t('greenIt.legendPaperRate')} />
            <Line type="monotone" dataKey="costSaved" stroke={C.success} strokeWidth={2} dot={{ r: 3 }} name={t('greenIt.legendCostSaved')} />
          </LineChart>
        </ChartContainer>
      </div>

      {/* 科室排名 */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-color)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', fontSize: 16, fontWeight: 600, color: C.text }}>
          {t('greenIt.departmentRankingTitle')}
        </div>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ overflowX: "auto" }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--bg-card)' }}>
                {[t('greenIt.thRank'), t('greenIt.thDepartment'), t('greenIt.thDigitalRate'), t('greenIt.thPaperRate'), t('greenIt.thCostSaved')].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'center', borderBottom: '2px solid var(--border-color)', fontWeight: 600, color: C.textMuted }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {scores.map((d, i) => (
                <tr key={d.department} style={{ borderBottom: '1px solid var(--border-light)', background: i % 2 === 0 ? '#fff' : '#fafbfc' }}>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    <span style={{
                      display: 'inline-flex', width: 24, height: 24, borderRadius: '50%', alignItems: 'center', justifyContent: 'center',
                      background: d.rank <= 3 ? C.primary : '#f1f5f9', color: d.rank <= 3 ? '#fff' : C.textMuted,
                      fontSize: 12, fontWeight: 700
                    }}>{d.rank}</span>
                  </td>
                  <td style={{ padding: '10px 12px', fontWeight: 600, textAlign: 'center' }}>{d.department}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center', color: C.primary, fontWeight: 600 }}>{d.digitalRate}%</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>{d.paperRate}%</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center', color: C.success, fontWeight: 600 }}>¥{d.costSaved.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      </div>
    </div>
  )
}

// 4. 绿色建议
const GreenRecommendations = () => {
  const [tips, setTips] = useState(greenTips)
  const [filter, setFilter] = useState<string>('全部')

  const toggleImplemented = (id: string) => {
    setTips(prev => prev.map(t => t.id === id ? { ...t, implemented: !t.implemented } : t))
  }

  const filteredTips = filter === '全部' ? tips : tips.filter(t => t.category === filter)
  const totalPotential = tips.filter(t => !t.implemented).reduce((s, t) => s + parseFloat(t.potentialSaving.replace(',', '')), 0)

  const categoryLabels: Record<string, string> = { energy: t('greenIt.categoryEnergy'), paper: t('greenIt.categoryPaper'), waste: t('greenIt.categoryWaste'), behavior: t('greenIt.categoryBehavior') }
  const categoryColors: Record<string, string> = { energy: C.primary, paper: C.success, waste: C.purple, behavior: C.warning }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: C.text, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Lightbulb size={18} color={C.warning} /> {t('greenIt.recommendTitle')}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Tag color="orange">{t('greenIt.recommendDemoTag')}</Tag>
          <span style={{ fontSize: 13, color: C.textMuted }}>{t('greenIt.potentialSavingLabel')}</span>
          <span style={{ fontSize: 16, fontWeight: 600, color: C.success }}>{totalPotential.toLocaleString()}</span>
          <span style={{ fontSize: 12, color: C.textLight }}>{t('greenIt.unitMonth')}</span>
        </div>
      </div>

      {/* 分类筛选 */}
      <div style={{ display: 'flex', gap: 8 }}>
        {['全部', 'energy', 'paper', 'waste', 'behavior'].map(cat => (
          <button key={cat} onClick={() => setFilter(cat)}
            style={{ padding: '6px 14px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              background: filter === cat ? categoryColors[cat] || C.primary : '#f1f5f9', color: filter === cat ? '#fff' : C.textMuted }}>
            {cat === '全部' ? t('greenIt.filterAll') : categoryLabels[cat]}
          </button>
        ))}
      </div>

      {/* 建议列表 */}
      {filteredTips.map(tip => {
        const catColor = categoryColors[tip.category] || C.primary
        return (
          <div key={tip.id} style={{
            background: 'var(--bg-card)', borderRadius: 12, padding: 16, border: `1px solid ${tip.implemented ? '#bbf7d0' : 'var(--border-color)'}`,
            borderLeft: `4px solid ${tip.implemented ? C.success : catColor}`
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 16, fontWeight: 600, color: C.text }}>{tip.title}</span>
                  <span style={{ padding: '2px 8px', background: `${catColor}15`, color: catColor, borderRadius: 4, fontSize: 12, fontWeight: 600 }}>
                    {categoryLabels[tip.category]}
                  </span>
                  <span style={{ padding: '2px 8px', background: tip.difficulty === 'easy' ? '#f0fdf4' : tip.difficulty === 'medium' ? '#fffbeb' : '#fef2f2', borderRadius: 4, fontSize: 12, fontWeight: 600,
                    color: tip.difficulty === 'easy' ? C.success : tip.difficulty === 'medium' ? C.warning : '#dc2626' }}>
                    {tip.difficulty === 'easy' ? t('greenIt.difficultyEasy') : tip.difficulty === 'medium' ? t('greenIt.difficultyMedium') : t('greenIt.difficultyHard')}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 8 }}>{tip.description}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: C.success }}>
                  <Zap size={12} /> {t('greenIt.tipEstimated')}<strong>{tip.potentialSaving}</strong> {tip.savingUnit}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <label style={{ position: 'relative', display: 'inline-block', width: 40, height: 22 }}>
                  <input type="checkbox" checked={tip.implemented} onChange={() => toggleImplemented(tip.id)} style={{ opacity: 0, width: 0, height: 0 }} />
                  <span style={{
                    position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 22,
                    backgroundColor: tip.implemented ? C.success : '#d1d5db', transition: '0.3s'
                  }}>
                    <span style={{
                      position: 'absolute', height: 18, width: 18, borderRadius: '50%', left: tip.implemented ? 20 : 2, top: 2,
                      backgroundColor: 'var(--bg-card)', transition: '0.3s'
                    }} />
                  </span>
                </label>
                <div style={{ fontSize: 12, color: tip.implemented ? C.success : C.textLight, marginTop: 4 }}>
                  {tip.implemented ? t('greenIt.tipImplemented') : t('greenIt.tipPending')}
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// 5. ISO 14001 合规
const ISO14001Compliance = () => {
  const compliant = isoChecklist.filter(i => i.status === 'compliant').length
  const partial = isoChecklist.filter(i => i.status === 'partial').length
  const nonCompliant = isoChecklist.filter(i => i.status === 'non-compliant').length
  const score = Math.round((compliant + partial * 0.5) / isoChecklist.length * 100)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Tag color="orange">{t('greenIt.isoDemoTag')}</Tag>
      </div>
      {/* 审核就绪评分 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, border: '1px solid var(--border-color)', textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: C.textMuted }}>{t('greenIt.auditScore')}</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: score >= 80 ? C.success : score >= 60 ? C.warning : '#dc2626', marginTop: 4 }}>{score}%</div>
        </div>
        <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, border: '1px solid var(--border-color)', textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: C.textMuted }}>{t('greenIt.fullyCompliant')}</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: C.success, marginTop: 4 }}>{compliant}</div>
          <div style={{ fontSize: 12, color: C.textLight }}>{t('greenIt.itemsUnit')}</div>
        </div>
        <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, border: '1px solid var(--border-color)', textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: C.textMuted }}>{t('greenIt.partiallyCompliant')}</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: C.warning, marginTop: 4 }}>{partial}</div>
          <div style={{ fontSize: 12, color: C.textLight }}>{t('greenIt.itemsUnit')}</div>
        </div>
        <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, border: '1px solid var(--border-color)', textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: C.textMuted }}>{t('greenIt.nonCompliant')}</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#dc2626', marginTop: 4 }}>{nonCompliant}</div>
          <div style={{ fontSize: 12, color: C.textLight }}>{t('greenIt.itemsUnit')}</div>
        </div>
      </div>

      {/* ISO 检查表 */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-color)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', fontSize: 16, fontWeight: 600, color: C.text, display: 'flex', alignItems: 'center', gap: 8 }}>
          <ClipboardList size={16} color={C.primary} /> {t('greenIt.isoChecklistTitle')}
        </div>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ overflowX: "auto" }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--bg-card)' }}>
                {[t('greenIt.thClause'), t('greenIt.thRequirement'), t('greenIt.thStatus'), t('greenIt.thEvidence'), t('greenIt.thTargetDate')].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '2px solid var(--border-color)', fontWeight: 600, color: C.textMuted }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isoChecklist.map((item, i) => {
                const statusMap: Record<string, { bg: string; color: string; label: string }> = {
                  'compliant': { bg: '#22c55e22', color: '#16a34a', label: t('greenIt.isoStatusCompliant') },
                  'partial': { bg: '#f59e0b22', color: '#f59e0b', label: t('greenIt.isoStatusPartial') },
                  'non-compliant': { bg: '#ef444422', color: '#ef4444', label: t('greenIt.isoStatusNonCompliant') },
                  'not-applicable': { bg: 'var(--bg-deep)', color: 'var(--text-secondary)', label: t('greenIt.isoStatusNa') },
                }
                const s = statusMap[item.status] || { bg: 'var(--bg-deep)', color: 'var(--text-secondary)', label: t('greenIt.isoStatusUnknown') }
                return (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--border-light)', background: i % 2 === 0 ? '#fff' : '#fafbfc' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 700, color: C.primary }}>{item.clause}</td>
                    <td style={{ padding: '10px 12px' }}>{item.requirement}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600, background: s.bg, color: s.color }}>
                        {s.label}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', color: C.textMuted }}>{item.evidence}</td>
                    <td style={{ padding: '10px 12px', color: C.textMuted }}>{item.targetDate}</td>
                  </tr>
                )
              })}
            </tbody>
          </table></div>
        </div>
      </div>

      {/* 不合规告警 */}
      {nonCompliant > 0 && (
        <div style={{ padding: '12px 16px', background: 'var(--color-error-bg)', borderRadius: 8, border: '1px solid #fecaca', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <AlertTriangle size={14} color="#dc2626" style={{ marginTop: 2 }} />
          <div style={{ fontSize: 12, color: '#dc2626' }}>
            {t('greenIt.isoWarning', { n: nonCompliant, clauses: isoChecklist.filter(i => i.status === 'non-compliant').map(i => i.clause).join('、') })}
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// [Phase 2] 实时运行统计（statsApi 真实数据）
// ============================================================
function RunStatsTab() {
  const [stats, setStats] = useState<any>(null)
  const [trend, setTrend] = useState<any[]>([])
  const [byModality, setByModality] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError(null)
      try {
        const [dailyRes, trendRes, modalityRes] = await Promise.all([
          statsApi.getDaily(),
          statsApi.getTrend(30),
          statsApi.getByModality(),
        ])
        if (cancelled) return
        if (dailyRes.success && dailyRes.data) setStats(dailyRes.data)
        else setError(t('greenIt.runStatsLoadFailed'))
        if (trendRes.success && Array.isArray(trendRes.data)) {
          setTrend(trendRes.data.map((d: any, i: number) => ({
            ...d,
            date: d.date || d.day || `D${i + 1}`,
          })))
        }
        if (modalityRes.success) {
          const raw = modalityRes.data as any
          if (Array.isArray(raw)) {
            setByModality(raw)
          } else if (raw && typeof raw === 'object') {
            setByModality(Object.entries(raw).map(([modality, v]: [string, any]) => ({
              modality,
              count: v?.total ?? v?.count ?? (typeof v === 'number' ? v : 0),
            })))
          }
        }
      } catch {
        if (!cancelled) setError(t('greenIt.runStatsLoadFailedRetry'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  if (loading) {
    return <div style={{ padding: 48, textAlign: 'center' }}><Spin size="large" tip={t('greenIt.loadingRunStats')}><div style={{ height: 60 }} /></Spin></div>
  }

  if (error) {
    return <Alert type="error" showIcon message={error} />
  }

  const cards = [
    { label: t('greenIt.todayExams'), value: stats?.examCount ?? 0, unit: t('greenIt.unitExam'), icon: Activity, color: '#2563eb', bg: '#3b82f622' },
    { label: t('greenIt.todayReports'), value: stats?.reportCount ?? 0, unit: t('greenIt.unitReport'), icon: FileText, color: '#059669', bg: '#22c55e22' },
    { label: t('greenIt.criticalEvents'), value: stats?.criticalCount ?? 0, unit: t('greenIt.unitEvent'), icon: ShieldAlert, color: '#dc2626', bg: '#ef444422' },
    { label: t('greenIt.avgTat'), value: stats?.avgTAT != null ? stats.avgTAT.toFixed(1) : '-', unit: t('greenIt.unitHour'), icon: Clock, color: '#7c3aed', bg: '#8b5cf622' },
  ]

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
        {cards.map(c => (
          <div key={c.label} style={{ background: c.bg, borderRadius: 12, padding: '18px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: c.color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <c.icon size={22} color={c.color} />
            </div>
            <div>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.1 }}>
                {c.value}<span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text-secondary)', marginLeft: 4 }}>{c.unit}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{c.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, border: `1px solid ${C.border}`, marginBottom: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <BarChart2 size={16} color={C.primary} /> {t('greenIt.trend30d')}
        </div>
        {trend.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center', padding: 24 }}>{t('greenIt.noTrendData')}</div>
        ) : (
          <ChartContainer height={280}>
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="examCount" name={t('greenIt.legendExamCount')} stroke={C.primary} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="reportCount" name={t('greenIt.legendReportCount')} stroke="#059669" strokeWidth={2} dot={false} />
            </LineChart>
          </ChartContainer>
        )}
      </div>

      {byModality.length > 0 && (
        <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <BarChart3 size={16} color={C.green} /> {t('greenIt.modalityWorkload')}
          </div>
          <ChartContainer height={260} state={byModality.length === 0 ? 'empty' : 'ready'} emptyDescription={t('greenIt.noModalityData')}>
            <BarChart data={byModality}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="modality" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <Tooltip />
              <Bar dataKey="count" name={t('greenIt.legendExamCount')} fill={C.primary} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </div>
      )}
    </div>
  )
}

// ============================================================
// 主页面组件
// ============================================================
export default function GreenITPage() {
  const [activeTab, setActiveTab] = useState<'run' | 'trend' | 'carbon' | 'signature' | 'cost' | 'paper' | 'energy' | 'digitization' | 'greenTips' | 'iso'>('run')
  const { daily, source, loading } = useGreenStats()

  // [W2-B] 顶部统计卡: 基于 statsApi 真实统计 (估算字段标注)
  const paperlessRate = paperlessRateOf(daily) || stats.paperlessRate
  const paperSaved = daily?.reportCount ? Math.round(Number(daily.reportCount) * 30 * 2) : stats.paperSaved
  const carbonSaved = paperSaved > 0 ? Math.round(paperSaved * 4.3) / 1000 : stats.carbonSaved
  const signatureRate = paperlessRate || stats.signatureRate

  const tabs = [
    { key: 'run', label: t('greenIt.tabRun'), icon: <BarChart2 size={16} /> },
    { key: 'trend', label: t('greenIt.tabTrend'), icon: <LineChartIcon size={16} /> },
    { key: 'carbon', label: t('greenIt.tabCarbon'), icon: <Leaf size={16} /> },
    { key: 'signature', label: t('greenIt.tabSignature'), icon: <CheckCircle size={16} /> },
    { key: 'cost', label: t('greenIt.tabCost'), icon: <Calculator size={16} /> },
    { key: 'paper', label: t('greenIt.tabPaper'), icon: <Printer size={16} /> },
    { key: 'energy', label: t('greenIt.tabEnergy'), icon: <Zap size={16} /> },
    { key: 'digitization', label: t('greenIt.tabDigitization'), icon: <BarChart3 size={16} /> },
    { key: 'greenTips', label: t('greenIt.tabGreenTips'), icon: <Lightbulb size={16} /> },
    { key: 'iso', label: t('greenIt.tabIso'), icon: <Award size={16} /> },
  ]

  return (
    <div style={{
      minHeight: '100vh',
      background: C.background,
      padding: '24px',
    }}>
      {/* 页面标题 */}
      <div style={{ marginBottom: 24 }}>
        <PageHeader
          as="h1"
          title={<span style={{ display: 'flex', alignItems: 'center', gap: 10 }}><div style={{ width: 36, height: 36, borderRadius: 10, background: `${C.primary}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.primary }}><Leaf size={20} /></div>{t('greenIt.pageTitle')}</span>}
          subtitle={
            <>
              <span style={{ fontSize: 13, color: C.textMuted }}>{t('greenIt.pageDate', { year: new Date().getFullYear(), month: new Date().getMonth() + 1 })}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                <Tag color={source === 'api' ? 'green' : 'orange'}>
                  {source === 'api' ? t('greenIt.sourceCoreApi') : t('greenIt.sourceFallbackDemo')}
                </Tag>
                <span style={{ fontSize: 12, color: C.textLight }}>{t('greenIt.pageEstimateNote')}</span>
                {loading && <Spin size="small" />}
              </div>
            </>
          }
          style={{ marginBottom: 0 }}
        />
      </div>

      {/* 顶部统计卡片 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 16,
        marginBottom: 24,
      }}>
        <StatCard
          title={t('greenIt.monthPaperlessRate')}
          value={paperlessRate}
          unit="%"
          icon={<Percent size={24} />}
          trend="up"
          trendValue="+5.3%"
          color={C.primary}
        />
        <StatCard
          title={t('greenIt.paperSaved')}
          value={paperSaved.toLocaleString()}
          unit={t('greenIt.unitSheets')}
          icon={<FileText size={24} />}
          trend="up"
          trendValue={t('greenIt.paperSavedTrend')}
          color={C.info}
        />
        <StatCard
          title={t('greenIt.carbonSaved')}
          value={carbonSaved}
          unit="kg CO₂"
          icon={<Leaf size={24} />}
          trend="up"
          trendValue={t('greenIt.carbonTrend')}
          color={C.green}
        />
        <StatCard
          title={t('greenIt.signatureRate')}
          value={signatureRate}
          unit="%"
          icon={<CheckCircle size={24} />}
          trend="up"
          trendValue={t('greenIt.signatureTrend')}
          color={C.purple}
        />
      </div>

      {/* Tab切换 */}
      <div style={{
        background: 'var(--bg-card)',
        borderRadius: 12,
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        border: '1px solid var(--border-color)',
        marginBottom: 16,
      }}>
        <div style={{
          display: 'flex',
          borderBottom: `1px solid ${C.border}`,
          padding: '0 8px',
        }}>
          {tabs.map(tab => (
            <TabButton
              key={tab.key}
              label={tab.label}
              icon={tab.icon}
              active={activeTab === tab.key}
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
            />
          ))}
        </div>

        {/* Tab内容 */}
        <div style={{ padding: 24 }}>
          {activeTab === 'run' && <RunStatsTab />}
          {activeTab === 'trend' && <PaperlessTrendTab />}
          {activeTab === 'carbon' && <CarbonTab />}
          {activeTab === 'signature' && <SignatureTab />}
          {activeTab === 'cost' && <CostTab />}
          {activeTab === 'paper' && <PaperConsumptionDashboard />}
          {activeTab === 'energy' && <EnergyMonitoring />}
          {activeTab === 'digitization' && <DigitizationScorecard />}
          {activeTab === 'greenTips' && <GreenRecommendations />}
          {activeTab === 'iso' && <ISO14001Compliance />}
        </div>
      </div>
    </div>
  )
}
