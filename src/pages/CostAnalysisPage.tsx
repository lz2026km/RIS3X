import { useState, useMemo, useEffect, useCallback } from 'react'
import { t } from '../i18n/appI18n'
import {
  TrendingUp, TrendingDown, DollarSign, Monitor, Users, Film,
  BarChart3, PieChart as PieChartIcon, Activity,
  Server, Clock, Scissors, HeartPulse,
  Package, Percent, Award, Wallet, FileText, ClipboardList, AlertTriangle,
  CheckCircle, XCircle, Ban, RefreshCw, Landmark, Download,
  Hash, List, ShieldBan, MessageSquare, ArrowRight
} from 'lucide-react'
import {
  BarChart as ChartBar, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  LineChart, Line
} from 'recharts'
import { financeApi } from '../services/api/financeApi'
import { statsApi } from '../services/api/statsApi'
import { ChartContainer } from '../components/charts'
import { CostFilter, CostOverview } from './cost'
import { CostCard, SimplePieChart, SimpleBarChart, SimpleHorizontalBarChart } from './cost/CostChart'
import {
  EquipmentRow, ConsumableRow, LaborRow, MedicalConsumableRow,
  DepreciationRow, ProfitMarginRow, DeptRevenueRow
} from './cost/CostTable'
import {
  type TimeRange, type TabType, type BenefitData,
  EQUIPMENT_DATA, CONSUMABLE_DATA, LABOR_DATA, BENEFIT_DATA,
  MEDICAL_CONSUMABLE_DATA, DEPT_CONSUMABLE_DATA,
  DEPRECIATION_DATA, EXAM_PROFIT_MARGIN_DATA, DEPT_REVENUE_DATA,
  DRG_DATA, BREAK_EVEN_DATA, INSURANCE_ALLOCATION,
  BUDGET_DATA, PL_DATA, CLAIMS_DATA,
  formatCurrency, formatPercent, calculateUnitCost,
} from './cost'

// [W3-B] 成本分析 — financeApi 实时数据 (MSW/后端双形状归一化)
interface LiveMonthlyPoint { month: string; revenue: number; cost: number }
interface LiveFinanceData {
  revenue: number
  cost: number
  profit: number
  marginPct: number
  totalExams: number
  monthly: LiveMonthlyPoint[]
  source: string
}

function toNumber(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

// 归一化 revenue-analysis 响应 (MSW: {daily,monthly} / Nest: {period,totalRevenue,totalCost,totalProfit})
function normalizeRevenue(payload: unknown): { revenue: number; monthly: { month: string; revenue: number }[] } {
  const p = (payload ?? {}) as Record<string, unknown>
  const monthlyRaw = Array.isArray(p.monthly) ? p.monthly : Array.isArray(p.daily) ? p.daily : []
  const monthly = monthlyRaw
    .map((m) => {
      const rec = (m ?? {}) as Record<string, unknown>
      return { month: String(rec.month ?? rec.date ?? ''), revenue: toNumber(rec.amount ?? rec.revenue) }
    })
    .filter((m) => m.month.length > 0)
  const sum = monthly.reduce((s, x) => s + x.revenue, 0)
  const revenue = sum > 0 ? sum : toNumber(p.totalRevenue ?? p.totalProfit)
  return { revenue, monthly }
}

function normalizeCost(payload: unknown): number {
  const p = (payload ?? {}) as Record<string, unknown>
  return toNumber(p.totalCost)
}

export default function CostAnalysisPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>('year')
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [live, setLive] = useState<LiveFinanceData | null>(null)

  const loadFinance = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [revRes, costRes, dailyRes] = await Promise.allSettled([
        financeApi.getRevenueAnalysis(),
        financeApi.getCostAccounting(),
        statsApi.getDaily(),
      ])
      const rev = revRes.status === 'fulfilled' && revRes.value.success ? revRes.value.data : null
      const cost = costRes.status === 'fulfilled' && costRes.value.success ? costRes.value.data : null
      const daily = dailyRes.status === 'fulfilled' && dailyRes.value.success ? dailyRes.value.data : null
      const { revenue, monthly } = normalizeRevenue(rev as unknown)
      const costTotal = normalizeCost(cost as unknown)
      const totalExams = toNumber((daily as Record<string, unknown> | null)?.examCount)
      if (revenue > 0 || costTotal > 0) {
        const costPerRevenue = revenue > 0 ? costTotal / revenue : 0
        setLive({
          revenue,
          cost: costTotal,
          profit: revenue - costTotal,
          marginPct: revenue > 0 ? ((revenue - costTotal) / revenue) * 100 : 0,
          totalExams,
          monthly: monthly.map((m) => ({
            month: m.month,
            revenue: m.revenue,
            cost: Math.round(m.revenue * costPerRevenue),
          })),
          source: t('costAnalysis.sourceRealtime'),
        })
      } else {
        setLive(null)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t('costAnalysis.loadFailed'))
      setLive(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadFinance() }, [loadFinance])

  const handleExportClaims837 = () => {
    const header = '单号,患者,类型,金额,状态'
    const rows = CLAIMS_DATA.claims.map(c => [c.id, c.patientName, c.type, c.amount, c.status].join(','))
    const blob = new Blob(['\uFEFF' + [header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = '837理赔导出.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const summaryData = useMemo(() => {
    const totalEquipmentCost = EQUIPMENT_DATA.reduce((sum, eq) => {
      const annualDep = eq.purchasePrice / eq.depreciationYears
      return sum + annualDep + eq.annualMaintenance
    }, 0)
    const totalConsumableCost = CONSUMABLE_DATA.reduce((sum, c) => sum + c.annualCost, 0)
    const totalLaborCost = LABOR_DATA.reduce((sum, l) => sum + l.count * l.avgSalary * 12, 0)
    const totalCost = totalEquipmentCost + totalConsumableCost + totalLaborCost
    const latestRevenue = BENEFIT_DATA[BENEFIT_DATA.length - 1]?.revenue || 0
    const latestProfit = BENEFIT_DATA[BENEFIT_DATA.length - 1]?.profit || 0
    const totalExams = BENEFIT_DATA.reduce((sum, b) => sum + b.examCount, 0)
    const monthlyAvgCost = totalCost / 12
    const costPerExam = totalCost / totalExams
    return { totalEquipmentCost, totalConsumableCost, totalLaborCost, totalCost, latestRevenue, latestProfit, totalExams, monthlyAvgCost, costPerExam }
  }, [])

  // [W3-B] 效益 Tab 实时行 (financeApi.monthly → 万元口径, 与 BENEFIT_DATA 一致)
  const benefitRows = useMemo<BenefitData[]>(() => {
    if (!live || live.monthly.length === 0) return BENEFIT_DATA
    return live.monthly.map((m) => ({
      month: m.month,
      revenue: m.revenue / 10000,
      cost: m.cost / 10000,
      profit: (m.revenue - m.cost) / 10000,
      examCount: 0,
    }))
  }, [live])

  const benefitTotals = useMemo(() => {
    if (!live) {
      const revenue = BENEFIT_DATA.reduce((s, b) => s + b.revenue, 0)
      const cost = BENEFIT_DATA.reduce((s, b) => s + b.cost, 0)
      const profit = BENEFIT_DATA.reduce((s, b) => s + b.profit, 0)
      return { revenue, cost, profit, marginPct: revenue > 0 ? (profit / revenue) * 100 : 0 }
    }
    return { revenue: live.revenue / 10000, cost: live.cost / 10000, profit: live.profit / 10000, marginPct: live.marginPct }
  }, [live])

  const benefitTrendLabel = useMemo(() => {
    if (!live || live.monthly.length < 2) return ''
    const last = live.monthly[live.monthly.length - 1]!
    const prev = live.monthly[live.monthly.length - 2]!
    const chg = prev.revenue > 0 ? ((last.revenue - prev.revenue) / prev.revenue) * 100 : 0
    return `${chg >= 0 ? '+' : ''}${chg.toFixed(1)}%`
  }, [live])

  const equipmentWithUnitCost = useMemo(() => {
    return EQUIPMENT_DATA.map(eq => ({ ...eq, unitCost: calculateUnitCost(eq), totalAnnual: (eq.purchasePrice / eq.depreciationYears) + eq.annualMaintenance }))
  }, [])

  const laborWithWorkload = useMemo(() => {
    const totalExams = BENEFIT_DATA.reduce((sum, b) => sum + b.examCount, 0)
    return LABOR_DATA.map(l => ({ ...l, annualCost: l.count * l.avgSalary * 12, workload: totalExams }))
  }, [])

  const medicalConsumableByType = useMemo(() => {
    const ctData = MEDICAL_CONSUMABLE_DATA.filter(d => d.examType === 'CT增强')
    const mrData = MEDICAL_CONSUMABLE_DATA.filter(d => d.examType === 'MR增强')
    const dsaData = MEDICAL_CONSUMABLE_DATA.filter(d => d.examType === 'DSA')
    return {
      ctTotal: ctData.reduce((s, d) => s + d.annualCost, 0),
      mrTotal: mrData.reduce((s, d) => s + d.annualCost, 0),
      dsaTotal: dsaData.reduce((s, d) => s + d.annualCost, 0),
      ctItems: ctData, mrItems: mrData, dsaItems: dsaData,
    }
  }, [])

  const depreciationStats = useMemo(() => {
    const straightLine = DEPRECIATION_DATA.filter(d => d.depreciationMethod === 'straightLine')
    const doubleDeclining = DEPRECIATION_DATA.filter(d => d.depreciationMethod === 'doubleDeclining')
    return {
      straightLineTotal: straightLine.reduce((s, d) => s + d.annualDepreciation, 0),
      doubleDecliningTotal: doubleDeclining.reduce((s, d) => s + d.annualDepreciation, 0),
      totalAnnual: DEPRECIATION_DATA.reduce((s, d) => s + d.annualDepreciation, 0),
      totalBookValue: DEPRECIATION_DATA.reduce((s, d) => s + d.currentBookValue, 0),
      totalAccumulated: DEPRECIATION_DATA.reduce((s, d) => s + d.accumulatedDepreciation, 0),
    }
  }, [])

  const profitMarginStats = useMemo(() => {
    const profitable = EXAM_PROFIT_MARGIN_DATA.filter(d => !d.isLoss)
    const lossMaking = EXAM_PROFIT_MARGIN_DATA.filter(d => d.isLoss)
    return {
      totalExams: EXAM_PROFIT_MARGIN_DATA.reduce((s, d) => s + d.monthlyCount, 0),
      profitableCount: profitable.length,
      lossMakingCount: lossMaking.length,
      totalMonthlyProfit: EXAM_PROFIT_MARGIN_DATA.reduce((s, d) => s + d.monthlyProfit, 0),
      avgProfitRate: EXAM_PROFIT_MARGIN_DATA.reduce((s, d) => s + d.profitRate, 0) / EXAM_PROFIT_MARGIN_DATA.length,
      lossExams: lossMaking,
    }
  }, [])

  const deptRevenueStats = useMemo(() => {
    const sorted = [...DEPT_REVENUE_DATA].sort((a, b) => b.monthlyProfit - a.monthlyProfit)
    return {
      sorted,
      totalProfit: DEPT_REVENUE_DATA.reduce((s, d) => s + d.monthlyProfit, 0),
      totalRevenue: DEPT_REVENUE_DATA.reduce((s, d) => s + d.monthlyRevenue, 0),
      avgProfitRate: DEPT_REVENUE_DATA.reduce((s, d) => s + (d.monthlyProfit / d.monthlyRevenue * 100), 0) / DEPT_REVENUE_DATA.length,
    }
  }, [])

  const containerStyle: React.CSSProperties = { minHeight: '100vh', background: '#0d1117', color: '#f0f6fc', padding: '24px' }
  const sectionTitleStyle: React.CSSProperties = { fontSize: 14, fontWeight: 600, color: '#f0f6fc', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }

  if (loading) return <div role="status" data-testid="cost-loading" style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>{t('costAnalysis.loading')}</div>;
  if (!EQUIPMENT_DATA || EQUIPMENT_DATA.length === 0) {
    return (
      <div data-testid="cost-empty" style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>
        <div style={{ fontSize: 14, marginBottom: 12 }}>{t('costAnalysis.noEquipmentData')}</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('costAnalysis.checkDateRange')}</div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <CostFilter activeTab={activeTab} onTabChange={setActiveTab} timeRange={timeRange} onTimeRangeChange={setTimeRange} />

      {/* [W3-B] 数据源状态条 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, fontSize: 12, flexWrap: 'wrap' }}>
        {live ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 999, background: '#22c55e20', color: '#22c55e', fontWeight: 600 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e' }} />
            {t('costAnalysis.dataSource')} {live.source} · 收入 ¥{(live.revenue / 10000).toFixed(1)}万 / 成本 ¥{(live.cost / 10000).toFixed(1)}万
          </span>
        ) : (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 999, background: '#f59e0b20', color: '#f59e0b', fontWeight: 600 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b' }} />
            {t('costAnalysis.dataSource')} {t('costAnalysis.demoData')} — 设备/耗材/人力/DRG/盈亏平衡等区块为内置演示数据
          </span>
        )}
        {error && (
          <span style={{ color: '#ef4444' }}>
            {t('costAnalysis.apiLoadFailed')} {error}{t('costAnalysis.apiFallback')}
            <button onClick={() => void loadFinance()} style={{ marginLeft: 8, padding: '2px 10px', borderRadius: 4, border: '1px solid #ef4444', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontSize: 12 }}>{t('costAnalysis.retry')}</button>
          </span>
        )}
      </div>

      {activeTab === 'overview' && <CostOverview live={live} />}

      {activeTab === 'equipment' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <CostCard title={t("costAnalysis.totalEquipmentAssets")} value={formatCurrency(EQUIPMENT_DATA.reduce((s, e) => s + e.purchasePrice, 0))} subtitle={`${EQUIPMENT_DATA.length} 台设备`} icon={Server} color="#3b82f6" />
            <CostCard title={t("costAnalysis.annualMaintenance")} value={formatCurrency(EQUIPMENT_DATA.reduce((s, e) => s + e.annualMaintenance, 0))} subtitle="年度维保支出" icon={Activity} color="#f59e0b" />
            <CostCard title={t("costAnalysis.annualExamTotal")} value={EQUIPMENT_DATA.reduce((s, e) => s + e.annualUsage, 0).toLocaleString()} subtitle="合计检查人次" icon={Monitor} color="#22c55e" />
          </div>
          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20 }}>
            <div style={sectionTitleStyle}><Server size={16} color="#3b82f6" />{t('costAnalysis.equipmentCostDetail')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 80px 100px 100px 100px 100px', gap: 8, padding: '8px 16px', background: '#21262d', borderBottom: '1px solid #30363d', fontSize: 12, fontWeight: 600, color: '#8b949e' }}>
              <span>#</span><span>{t('costAnalysis.equipmentName')}</span><span>{t('costAnalysis.equipmentType')}</span><span>{t('costAnalysis.purchasePriceWan')}</span><span>{t('costAnalysis.annualCostWan')}</span><span>{t('costAnalysis.annualExamCount')}</span><span>{t('costAnalysis.unitCost')}</span>
            </div>
            {equipmentWithUnitCost.map((eq, idx) => (<EquipmentRow key={eq.id} equipment={eq} index={idx} />))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20 }}>
              <div style={sectionTitleStyle}><Monitor size={16} color="#3b82f6" />{t('costAnalysis.equipmentTypeDistribution')}</div>
              <SimplePieChart data={[
                { label: t("costAnalysis.ctEquipment"), value: EQUIPMENT_DATA.filter(e => e.modality === 'CT').reduce((s, e) => s + e.purchasePrice, 0), color: '#3b82f6' },
                { label: t("costAnalysis.mriEquipment"), value: EQUIPMENT_DATA.filter(e => e.modality === 'MRI').reduce((s, e) => s + e.purchasePrice, 0), color: '#8b5cf6' },
                { label: t("costAnalysis.dsaEquipment"), value: EQUIPMENT_DATA.filter(e => e.modality === 'DSA').reduce((s, e) => s + e.purchasePrice, 0), color: '#f59e0b' },
              ]} size={120} />
            </div>
            <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20 }}>
              <div style={sectionTitleStyle}><Scissors size={16} color="#22c55e" />{t('costAnalysis.unitExamCostDistribution')}</div>
              <SimpleBarChart data={equipmentWithUnitCost.map(eq => ({ label: eq.modality, value: eq.unitCost, color: eq.modality === 'CT' ? '#3b82f6' : eq.modality === 'MRI' ? '#8b5cf6' : '#f59e0b' }))} height={160} />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'consumable' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            <CostCard title={t("costAnalysis.filmConsumable")} value={formatCurrency(CONSUMABLE_DATA.filter(c => c.category === '胶片').reduce((s, c) => s + c.annualCost, 0), true)} subtitle="X光胶片/打印片" icon={Film} color="#22c55e" />
            <CostCard title={t("costAnalysis.contrastAgent")} value={formatCurrency(CONSUMABLE_DATA.filter(c => c.category === '对比剂').reduce((s, c) => s + c.annualCost, 0), true)} subtitle="CT/MRI增强" icon={HeartPulse} color="#3b82f6" />
            <CostCard title={t("costAnalysis.dsaConsumable")} value={formatCurrency(CONSUMABLE_DATA.filter(c => c.category === '耗材').reduce((s, c) => s + c.annualCost, 0), true)} subtitle="导管/介入耗材" icon={Activity} color="#f59e0b" />
            <CostCard title={t("costAnalysis.consumableTotal")} value={formatCurrency(summaryData.totalConsumableCost)} subtitle={`${CONSUMABLE_DATA.length} 类耗材`} icon={Scissors} color="#ef4444" />
          </div>
          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20 }}>
            <div style={sectionTitleStyle}><Film size={16} color="#22c55e" />{t('costAnalysis.consumableDetail')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 80px 80px 100px 100px', gap: 8, padding: '8px 16px', background: '#21262d', borderBottom: '1px solid #30363d', fontSize: 12, fontWeight: 600, color: '#8b949e' }}>
              <span>#</span><span>{t('costAnalysis.name')}</span><span>{t('costAnalysis.category')}</span><span>{t('costAnalysis.unitPrice')}</span><span>{t('costAnalysis.monthlyUsage')}</span><span>{t('costAnalysis.annualCost')}</span>
            </div>
            {CONSUMABLE_DATA.map((item, idx) => (<ConsumableRow key={item.id} item={item} index={idx} />))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20 }}>
              <div style={sectionTitleStyle}><PieChartIcon size={16} color="#8b949e" />{t('costAnalysis.consumableCategoryDistribution')}</div>
              <SimplePieChart data={[
                { label: '胶片', value: CONSUMABLE_DATA.filter(c => c.category === '胶片').reduce((s, c) => s + c.annualCost, 0), color: '#22c55e' },
                { label: '对比剂', value: CONSUMABLE_DATA.filter(c => c.category === '对比剂').reduce((s, c) => s + c.annualCost, 0), color: '#3b82f6' },
                { label: '注射器', value: CONSUMABLE_DATA.filter(c => c.category === '注射器').reduce((s, c) => s + c.annualCost, 0), color: '#f59e0b' },
                { label: 'DSA耗材', value: CONSUMABLE_DATA.filter(c => c.category === '耗材').reduce((s, c) => s + c.annualCost, 0), color: '#ef4444' },
                { label: '其他', value: CONSUMABLE_DATA.filter(c => c.category === '其他').reduce((s, c) => s + c.annualCost, 0), color: '#8b949e' },
              ]} size={130} />
            </div>
            <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20 }}>
              <div style={sectionTitleStyle}><BarChart3 size={16} color="#3b82f6" />{t('costAnalysis.majorConsumableRanking')}</div>
              <SimpleBarChart data={CONSUMABLE_DATA.sort((a, b) => b.annualCost - a.annualCost).slice(0, 6).map(c => ({ label: c.category, value: c.annualCost, color: c.category === '胶片' ? '#22c55e' : c.category === '对比剂' ? '#3b82f6' : c.category === '耗材' ? '#ef4444' : '#f59e0b' }))} height={160} />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'labor' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            <CostCard title={t("costAnalysis.technicianLabor")} value={formatCurrency(laborWithWorkload.filter(l => l.role.includes('技师')).reduce((s, l) => s + l.annualCost, 0), true)} subtitle={`${laborWithWorkload.filter(l => l.role.includes('技师')).reduce((s, l) => s + l.count, 0)} 人`} icon={Users} color="#3b82f6" />
            <CostCard title={t("costAnalysis.nurseLabor")} value={formatCurrency(laborWithWorkload.filter(l => l.role.includes('护士')).reduce((s, l) => s + l.annualCost, 0), true)} subtitle={`${laborWithWorkload.filter(l => l.role.includes('护士')).reduce((s, l) => s + l.count, 0)} 人`} icon={Users} color="#22c55e" />
            <CostCard title={t("costAnalysis.physicianLabor")} value={formatCurrency(laborWithWorkload.filter(l => l.role.includes('医师')).reduce((s, l) => s + l.annualCost, 0), true)} subtitle={`${laborWithWorkload.filter(l => l.role.includes('医师')).reduce((s, l) => s + l.count, 0)} 人`} icon={Users} color="#f59e0b" />
            <CostCard title={t("costAnalysis.laborCostTotal")} value={formatCurrency(summaryData.totalLaborCost)} subtitle={`${LABOR_DATA.reduce((s, l) => s + l.count, 0)} 人`} icon={DollarSign} color="#ef4444" />
          </div>
          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20 }}>
            <div style={sectionTitleStyle}><Users size={16} color="#3b82f6" />{t('costAnalysis.laborCostDetail')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 60px 100px 100px 100px', gap: 8, padding: '8px 16px', background: '#21262d', borderBottom: '1px solid #30363d', fontSize: 12, fontWeight: 600, color: '#8b949e' }}>
              <span>#</span><span>{t('costAnalysis.position')}</span><span>{t('costAnalysis.headcount')}</span><span>{t('costAnalysis.monthlySalary')}</span><span>{t('costAnalysis.annualCostYuan')}</span><span>{t('costAnalysis.avgAnnualExamPerPerson')}</span>
            </div>
            {laborWithWorkload.map((item, idx) => (<LaborRow key={item.id} item={item} index={idx} />))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20 }}>
              <div style={sectionTitleStyle}><PieChartIcon size={16} color="#8b949e" />{t('costAnalysis.laborCostByPosition')}</div>
              <SimplePieChart data={[
                { label: t("costAnalysis.radiologyTech"), value: laborWithWorkload.filter(l => l.role.includes('技师')).reduce((s, l) => s + l.annualCost, 0), color: '#3b82f6' },
                { label: '护士', value: laborWithWorkload.filter(l => l.role.includes('护士')).reduce((s, l) => s + l.annualCost, 0), color: '#22c55e' },
                { label: t("costAnalysis.radiologyPhysician"), value: laborWithWorkload.filter(l => l.role.includes('医师')).reduce((s, l) => s + l.annualCost, 0), color: '#f59e0b' },
                { label: t("costAnalysis.adminSupport"), value: laborWithWorkload.filter(l => !l.role.includes('技师') && !l.role.includes('护士') && !l.role.includes('医师')).reduce((s, l) => s + l.annualCost, 0), color: '#8b949e' },
              ]} size={130} />
            </div>
            <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20 }}>
              <div style={sectionTitleStyle}><BarChart3 size={16} color="#22c55e" />{t('costAnalysis.avgAnnualCostByPosition')}</div>
              <SimpleBarChart data={[
                { label: t("costAnalysis.ctTechnician"), value: laborWithWorkload.find(l => l.id === 'tech-ct')?.annualCost || 0, color: '#3b82f6' },
                { label: t("costAnalysis.mriTechnician"), value: laborWithWorkload.find(l => l.id === 'tech-mri')?.annualCost || 0, color: '#8b5cf6' },
                { label: t("costAnalysis.dsaTechnician"), value: laborWithWorkload.find(l => l.id === 'tech-dsa')?.annualCost || 0, color: '#f59e0b' },
                { label: '医师', value: laborWithWorkload.find(l => l.id === 'physician')?.annualCost || 0, color: '#22c55e' },
              ]} height={160} />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'benefit' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            <CostCard title={t("costAnalysis.annualRevenue")} value={formatCurrency(benefitTotals.revenue)} subtitle={live ? '财务接口实时聚合' : '近12个月累计'} icon={TrendingUp} trend="up" trendValue={benefitTrendLabel || '+18.2%'} color="#22c55e" />
            <CostCard title={t("costAnalysis.annualCostLabel")} value={formatCurrency(benefitTotals.cost)} subtitle={live ? '财务接口实时聚合' : '近12个月累计'} icon={DollarSign} color="#ef4444" />
            <CostCard title={t("costAnalysis.annualProfit")} value={formatCurrency(benefitTotals.profit)} subtitle="{t('costAnalysis.revenueMinusCost')}" icon={TrendingUp} trend="up" trendValue="+22.5%" color="#22c55e" />
            <CostCard title={t("costAnalysis.profitRate")} value={formatPercent(benefitTotals.marginPct)} subtitle="{t('costAnalysis.profitOverRevenue')}" icon={BarChart3} color="#3b82f6" />
          </div>

          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20 }}>
            <div style={sectionTitleStyle}><BarChart3 size={16} color="#3b82f6" />{t('costAnalysis.monthlyRevenueVsCostTrend')} {live && <span style={{ fontSize: 11, color: '#22c55e' }}>(financeApi 实时 · 成本按收入占比分摊)</span>}</div>
            <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 12, height: 12, borderRadius: 2, background: '#22c55e' }} />
                <span style={{ fontSize: 12, color: '#8b949e' }}>{t('costAnalysis.revenue')}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 12, height: 12, borderRadius: 2, background: '#ef4444' }} />
                <span style={{ fontSize: 12, color: '#8b949e' }}>{t('costAnalysis.cost')}</span>
              </div>
            </div>
            <SimpleBarChart data={benefitRows.map(b => ({ label: b.month.length >= 7 ? b.month.slice(5) : b.month, value: b.revenue, color: '#22c55e' }))} height={200} />
            <div style={{ marginTop: 12 }}>
              <SimpleBarChart data={benefitRows.map(b => ({ label: b.month.length >= 7 ? b.month.slice(5) : b.month, value: b.cost, color: '#ef4444' }))} height={200} />
            </div>
          </div>

          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20 }}>
            <div style={sectionTitleStyle}><TrendingUp size={16} color="#22c55e" />{t('costAnalysis.monthlyProfitTrend')} {live && <span style={{ fontSize: 11, color: '#22c55e' }}>(实时)</span>}</div>
            <SimpleBarChart data={benefitRows.map(b => ({ label: b.month.length >= 7 ? b.month.slice(5) : b.month, value: b.profit, color: '#22c55e' }))} height={200} />
          </div>

          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20 }}>
            <div style={sectionTitleStyle}><Activity size={16} color="#8b949e" />{t('costAnalysis.monthlyBenefitDetail')} {live && <span style={{ fontSize: 11, color: '#22c55e' }}>(financeApi 实时)</span>}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '80px 100px 100px 100px 100px', gap: 8, padding: '8px 16px', background: '#21262d', borderBottom: '1px solid #30363d', fontSize: 12, fontWeight: 600, color: '#8b949e' }}>
              <span>{t('costAnalysis.month')}</span><span>{t('costAnalysis.revenueWan')}</span><span>{t('costAnalysis.costWan')}</span><span>{t('costAnalysis.profitWan')}</span><span>{t('costAnalysis.examCount')}</span>
            </div>
            {benefitRows.map((item, idx) => {
              const profitRate = (item.profit / item.revenue) * 100
              return (
                <div key={item.month} style={{ display: 'grid', gridTemplateColumns: '80px 100px 100px 100px 100px', gap: 8, padding: '12px 16px', borderBottom: '1px solid #21262d', background: idx % 2 === 0 ? '#0d1117' : '#161b22', alignItems: 'center' }}>
                  <span style={{ color: '#8b949e', fontSize: 13 }}>{item.month}</span>
                  <span style={{ color: '#22c55e', fontSize: 13 }}>{formatCurrency(item.revenue)}</span>
                  <span style={{ color: '#ef4444', fontSize: 13 }}>{formatCurrency(item.cost)}</span>
                  <span style={{ color: '#22c55e', fontSize: 13, fontWeight: 600 }}>{formatCurrency(item.profit)}</span>
                  <span style={{ color: '#f0f6fc', fontSize: 13 }}>{item.examCount > 0 ? item.examCount.toLocaleString() : '-'}<span style={{ color: '#6e7681', fontSize: 12, marginLeft: 4 }}>({profitRate > 0 ? '+' : ''}{profitRate.toFixed(1)}%)</span></span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {activeTab === 'medicalConsumable' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            <CostCard title={t("costAnalysis.ctEnhancedSupply")} value={formatCurrency(medicalConsumableByType.ctTotal / 10000, true)} subtitle="对比剂/注射器/针管" icon={Package} color="#3b82f6" />
            <CostCard title={t("costAnalysis.mrEnhancedSupply")} value={formatCurrency(medicalConsumableByType.mrTotal / 10000, true)} subtitle="钆剂/注射器" icon={Package} color="#8b5cf6" />
            <CostCard title={t("costAnalysis.dsaSupply")} value={formatCurrency(medicalConsumableByType.dsaTotal / 10000, true)} subtitle="导管/支架/造影剂" icon={Package} color="#f59e0b" />
            <CostCard title={t("costAnalysis.supplyTotal")} value={formatCurrency((medicalConsumableByType.ctTotal + medicalConsumableByType.mrTotal + medicalConsumableByType.dsaTotal) / 10000, true)} subtitle="年消耗成本" icon={Wallet} color="#ef4444" />
          </div>

          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20 }}>
            <div style={sectionTitleStyle}><Package size={16} color="#22c55e" />{t('costAnalysis.supplyDetail')}</div>
            {(['CT增强', 'MR增强', 'DSA'] as const).map(type => {
              const typeColor = type === 'CT增强' ? '#3b82f6' : type === 'MR增强' ? '#8b5cf6' : '#f59e0b'
              const items = type === 'CT增强' ? medicalConsumableByType.ctItems : type === 'MR增强' ? medicalConsumableByType.mrItems : medicalConsumableByType.dsaItems
              return (
                <div key={type} style={{ marginBottom: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, padding: '8px 12px', background: `${typeColor}20`, borderRadius: 6, borderLeft: `3px solid ${typeColor}` }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: typeColor }}>{type === 'CT增强' ? t('costAnalysis.ctEnhanced') : type === 'MR增强' ? t('costAnalysis.mrEnhanced') : 'DSA'}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '40px 80px 1fr 80px 80px 100px 120px', gap: 8, padding: '8px 16px', background: '#21262d', borderBottom: '1px solid #30363d', fontSize: 12, fontWeight: 600, color: '#8b949e' }}>
                    <span>#</span><span>{t('costAnalysis.equipmentType')}</span><span>{t('costAnalysis.itemName')}</span><span>{t('costAnalysis.unit')}</span><span>{t('costAnalysis.unitPriceYuan')}</span><span>{t('costAnalysis.monthlyUsage')}</span><span>{t('costAnalysis.annualCostYuan')}</span>
                  </div>
                  {items.map((item, idx) => (<MedicalConsumableRow key={item.id} item={item} index={idx} />))}
                </div>
              )
            })}
          </div>

          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20 }}>
            <div style={sectionTitleStyle}><Award size={16} color="#22c55e" />{t('costAnalysis.deptSupplyRanking')}</div>
            <div style={{ marginBottom: 16 }}>
              <SimpleHorizontalBarChart data={DEPT_CONSUMABLE_DATA.sort((a, b) => b.total - a.total).map(d => ({ label: d.deptName, value: d.total, color: d.modality === 'CT' ? '#3b82f6' : d.modality === 'MRI' ? '#8b5cf6' : d.modality === 'DSA' ? '#f59e0b' : '#22c55e' }))} height={180} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 80px 100px 100px 100px', gap: 8, padding: '8px 16px', background: '#21262d', borderBottom: '1px solid #30363d', fontSize: 12, fontWeight: 600, color: '#8b949e' }}>
              <span>#</span><span>{t('costAnalysis.dept')}</span><span>{t('costAnalysis.equipmentType')}</span><span>{t('costAnalysis.ctSupplyWan')}</span><span>{t('costAnalysis.mrSupplyWan')}</span><span>{t('costAnalysis.dsaSupplyWan')}</span>
            </div>
            {DEPT_CONSUMABLE_DATA.sort((a, b) => b.total - a.total).map((item, idx) => (
              <div key={item.deptId} style={{ display: 'grid', gridTemplateColumns: '40px 1fr 80px 100px 100px 100px', gap: 8, padding: '12px 16px', borderBottom: '1px solid #21262d', background: idx % 2 === 0 ? '#0d1117' : '#161b22', alignItems: 'center' }}>
                <span style={{ color: '#6e7681', fontSize: 12 }}>{idx + 1}</span>
                <span style={{ color: '#f0f6fc', fontSize: 13 }}>{item.deptName}</span>
                <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 500, background: item.modality === 'CT' ? '#3b82f620' : item.modality === 'MRI' ? '#8b5cf620' : item.modality === 'DSA' ? '#f59e0b20' : '#22c55e20', color: item.modality === 'CT' ? '#3b82f6' : item.modality === 'MRI' ? '#8b5cf6' : item.modality === 'DSA' ? '#f59e0b' : '#22c55e' }}>{item.modality}</span>
                <span style={{ color: '#3b82f6', fontSize: 13 }}>{item.ctConsumable > 0 ? `${item.ctConsumable}万` : '-'}</span>
                <span style={{ color: '#8b5cf6', fontSize: 13 }}>{item.mrConsumable > 0 ? `${item.mrConsumable}万` : '-'}</span>
                <span style={{ color: '#f59e0b', fontSize: 13 }}>{item.dsaConsumable > 0 ? `${item.dsaConsumable}万` : '-'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'depreciation' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            <CostCard title={t("costAnalysis.equipmentTotalPrice")} value={formatCurrency(DEPRECIATION_DATA.reduce((s, d) => s + d.purchasePrice, 0))} subtitle={`${DEPRECIATION_DATA.length} 台设备`} icon={Server} color="#3b82f6" />
            <CostCard title={t("costAnalysis.annualDepreciationTotal")} value={formatCurrency(depreciationStats.totalAnnual)} subtitle="当年折旧金额" icon={TrendingDown} color="#ef4444" />
            <CostCard title={t("costAnalysis.accumulatedDepreciation")} value={formatCurrency(depreciationStats.totalAccumulated)} subtitle="已计提折旧" icon={Clock} color="#f59e0b" />
            <CostCard title={t("costAnalysis.currentNetValue")} value={formatCurrency(depreciationStats.totalBookValue)} subtitle="设备剩余价值" icon={Wallet} color="#22c55e" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20 }}>
              <div style={sectionTitleStyle}><Activity size={16} color="#3b82f6" />{t('costAnalysis.straightLineDepreciation')}</div>
              <div style={{ fontSize: 12, color: '#8b949e', lineHeight: 1.6 }}>
                <p style={{ marginBottom: 8 }}>{t('costAnalysis.formulaStraightLine')}</p>
                <p>{t('costAnalysis.featureStraightLine')}</p>
              </div>
              <div style={{ marginTop: 16, padding: 12, background: '#21262d', borderRadius: 6 }}>
                <div style={{ fontSize: 12, color: '#f0f6fc' }}>{t('costAnalysis.annualDepreciationLabel')} <span style={{ color: '#ef4444', fontWeight: 600 }}>{formatCurrency(depreciationStats.straightLineTotal)}</span></div>
              </div>
            </div>
            <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20 }}>
              <div style={sectionTitleStyle}><TrendingDown size={16} color="#8b5cf6" />{t('costAnalysis.doubleDecliningBalance')}</div>
              <div style={{ fontSize: 12, color: '#8b949e', lineHeight: 1.6 }}>
                <p style={{ marginBottom: 8 }}>{t('costAnalysis.formulaDoubleDeclining')}</p>
                <p>{t('costAnalysis.featureDoubleDeclining')}</p>
              </div>
              <div style={{ marginTop: 16, padding: 12, background: '#21262d', borderRadius: 6 }}>
                <div style={{ fontSize: 12, color: '#f0f6fc' }}>{t('costAnalysis.annualDepreciationLabel')} <span style={{ color: '#8b5cf6', fontWeight: 600 }}>{formatCurrency(depreciationStats.doubleDecliningTotal)}</span></div>
              </div>
            </div>
          </div>

          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20 }}>
            <div style={sectionTitleStyle}><Server size={16} color="#22c55e" />{t('costAnalysis.equipmentDepreciationDetail')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 80px 80px 80px 80px 100px 100px 100px', gap: 8, padding: '8px 16px', background: '#21262d', borderBottom: '1px solid #30363d', fontSize: 12, fontWeight: 600, color: '#8b949e' }}>
              <span>#</span><span>{t('costAnalysis.equipmentName')}</span><span>{t('costAnalysis.equipmentType')}</span><span>{t('costAnalysis.depreciationMethod')}</span><span>{t('costAnalysis.years')}</span><span>{t('costAnalysis.originalPriceWan')}</span><span>{t('costAnalysis.monthlyDepreciationWan')}</span><span>{t('costAnalysis.annualDepreciationWan')}</span><span>{t('costAnalysis.currentNetValueWan')}</span>
            </div>
            {DEPRECIATION_DATA.map((item, idx) => (<DepreciationRow key={item.id} item={item} index={idx} />))}
          </div>

          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20 }}>
            <div style={sectionTitleStyle}><Award size={16} color="#22c55e" />{t('costAnalysis.equipmentAnnualDepreciationRanking')}</div>
            <SimpleHorizontalBarChart data={DEPRECIATION_DATA.sort((a, b) => b.annualDepreciation - a.annualDepreciation).map(d => ({ label: d.name.length > 12 ? d.name.slice(0, 12) + '...' : d.name, value: d.annualDepreciation, color: d.modality === 'CT' ? '#3b82f6' : d.modality === 'MRI' ? '#8b5cf6' : '#f59e0b' }))} height={160} />
          </div>
        </div>
      )}

      {activeTab === 'profitMargin' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            <CostCard title={t("costAnalysis.examItemCount")} value={EXAM_PROFIT_MARGIN_DATA.length.toString()} subtitle="全部项目" icon={BarChart3} color="#3b82f6" />
            <CostCard title={t("costAnalysis.profitableItems")} value={profitMarginStats.profitableCount.toString()} subtitle={`占比 ${((profitMarginStats.profitableCount / EXAM_PROFIT_MARGIN_DATA.length) * 100).toFixed(0)}%`} icon={TrendingUp} trend="up" color="#22c55e" />
            <CostCard title={t("costAnalysis.lossItems")} value={profitMarginStats.lossMakingCount.toString()} subtitle="需重点关注" icon={TrendingDown} trend="down" color="#ef4444" />
            <CostCard title={t("costAnalysis.monthlyTotalProfit")} value={`¥${(profitMarginStats.totalMonthlyProfit / 10000).toFixed(1)}万`} subtitle="检查项目利润" icon={Wallet} color="#22c55e" />
          </div>

          {profitMarginStats.lossExams.length > 0 && (
            <div style={{ background: '#ef444420', border: '1px solid #ef4444', borderRadius: 8, padding: 20 }}>
              <div style={sectionTitleStyle}><TrendingDown size={16} color="#ef4444" />⚠️ {t('costAnalysis.lossItemWarning')}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 12 }}>
                {profitMarginStats.lossExams.map(exam => (
                  <div key={exam.id} style={{ background: '#161b22', borderRadius: 6, padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 13, color: '#f0f6fc', fontWeight: 500 }}>{exam.examName}</div>
                      <div style={{ fontSize: 12, color: '#8b949e' }}>{exam.modality} · {exam.monthlyCount}{t('costAnalysis.casesPerMonth')}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 14, color: '#ef4444', fontWeight: 600 }}>-¥{Math.abs(exam.monthlyProfit).toLocaleString()}</div>
                      <div style={{ fontSize: 12, color: '#ef4444' }}>{t('costAnalysis.profitRateLabel')}{exam.profitRate.toFixed(1)}%</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20 }}>
            <div style={sectionTitleStyle}><Percent size={16} color="#22c55e" />{t('costAnalysis.perExamCostProfitRate')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 80px 90px 90px 90px 100px 100px', gap: 8, padding: '8px 16px', background: '#21262d', borderBottom: '1px solid #30363d', fontSize: 12, fontWeight: 600, color: '#8b949e' }}>
              <span>#</span><span>{t('costAnalysis.itemName')}</span><span>{t('costAnalysis.equipmentType')}</span><span>{t('costAnalysis.monthlyExamVolume')}</span><span>{t('costAnalysis.revenueYuan')}</span><span>{t('costAnalysis.costYuan')}</span><span>{t('costAnalysis.profitRateCol')}</span><span>{t('costAnalysis.monthlyProfitYuan')}</span>
            </div>
            {EXAM_PROFIT_MARGIN_DATA.sort((a, b) => b.profitRate - a.profitRate).map((item, idx) => (<ProfitMarginRow key={item.id} item={item} index={idx} />))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20 }}>
              <div style={sectionTitleStyle}><PieChartIcon size={16} color="#3b82f6" />{t('costAnalysis.profitRateDistribution')}</div>
              <SimplePieChart data={[
                { label: '高利润率(>40%)', value: EXAM_PROFIT_MARGIN_DATA.filter(d => d.profitRate > 40 && !d.isLoss).reduce((s, d) => s + d.monthlyProfit, 0), color: '#22c55e' },
                { label: '中等利润率(20-40%)', value: EXAM_PROFIT_MARGIN_DATA.filter(d => d.profitRate >= 20 && d.profitRate <= 40 && !d.isLoss).reduce((s, d) => s + d.monthlyProfit, 0), color: '#3b82f6' },
                { label: '低利润率(<20%)', value: EXAM_PROFIT_MARGIN_DATA.filter(d => d.profitRate < 20 && d.profitRate > 0 && !d.isLoss).reduce((s, d) => s + d.monthlyProfit, 0), color: '#f59e0b' },
                { label: '亏损项目', value: Math.abs(EXAM_PROFIT_MARGIN_DATA.filter(d => d.isLoss).reduce((s, d) => s + d.monthlyProfit, 0)), color: '#ef4444' },
              ]} size={130} />
            </div>
            <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20 }}>
              <div style={sectionTitleStyle}><BarChart3 size={16} color="#22c55e" />{t('costAnalysis.itemProfitRanking')}</div>
              <SimpleHorizontalBarChart data={EXAM_PROFIT_MARGIN_DATA.sort((a, b) => b.monthlyProfit - a.monthlyProfit).slice(0, 5).map(d => ({ label: d.examName.length > 8 ? d.examName.slice(0, 8) + '...' : d.examName, value: Math.abs(d.monthlyProfit), color: d.isLoss ? '#ef4444' : '#22c55e' }))} height={160} />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'departmentRanking' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            <CostCard title={t("costAnalysis.monthlyRevenue")} value={formatCurrency(deptRevenueStats.totalRevenue)} subtitle="全科室合计" icon={TrendingUp} trend="up" trendValue="+8.5%" color="#22c55e" />
            <CostCard title={t("costAnalysis.monthlyTotalProfit")} value={formatCurrency(deptRevenueStats.totalProfit)} subtitle="全科室合计" icon={Wallet} trend="up" trendValue="+12.3%" color="#22c55e" />
            <CostCard title={t("costAnalysis.avgProfitRate")} value={formatPercent(deptRevenueStats.avgProfitRate)} subtitle="科室平均" icon={Percent} color="#3b82f6" />
            <CostCard title={t("costAnalysis.rankingDepts")} value={DEPT_REVENUE_DATA.length.toString()} subtitle="CT/MRI/DSA/普放" icon={Award} color="#f59e0b" />
          </div>

          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20 }}>
            <div style={sectionTitleStyle}><BarChart3 size={16} color="#22c55e" />{t('costAnalysis.deptRevenueRankingBar')}</div>
            <SimpleBarChart data={deptRevenueStats.sorted.map(d => ({ label: d.deptName, value: d.monthlyProfit, color: d.modality === 'CT' ? '#3b82f6' : d.modality === 'MRI' ? '#8b5cf6' : d.modality === 'DSA' ? '#f59e0b' : '#22c55e' }))} height={220} />
          </div>

          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20 }}>
            <div style={sectionTitleStyle}><Award size={16} color="#22c55e" />{t('costAnalysis.deptRevenueRankingDetail')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 80px 90px 90px 90px 80px 90px 90px 90px', gap: 8, padding: '8px 16px', background: '#21262d', borderBottom: '1px solid #30363d', fontSize: 12, fontWeight: 600, color: '#8b949e' }}>
              <span>{t('costAnalysis.rank')}</span><span>{t('costAnalysis.dept')}</span><span>{t('costAnalysis.equipmentType')}</span><span>{t('costAnalysis.examCount')}</span><span>{t('costAnalysis.monthRevenueWan')}</span><span>{t('costAnalysis.monthCostWan')}</span><span>{t('costAnalysis.monthProfitWan')}</span><span>{t('costAnalysis.perCapitaProfit')}</span><span>{t('costAnalysis.yoy')}</span><span>{t('costAnalysis.mom')}</span>
            </div>
            {deptRevenueStats.sorted.map((item, idx) => (<DeptRevenueRow key={item.deptId} item={item} index={idx} />))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20 }}>
              <div style={sectionTitleStyle}><TrendingUp size={16} color="#22c55e" />{t('costAnalysis.yoyGrowthRanking')}</div>
              <SimpleHorizontalBarChart data={DEPT_REVENUE_DATA.sort((a, b) => b.yoyGrowth - a.yoyGrowth).map(d => ({ label: d.deptName, value: d.yoyGrowth, color: d.yoyGrowth >= 0 ? '#22c55e' : '#ef4444' }))} height={160} />
            </div>
            <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20 }}>
              <div style={sectionTitleStyle}><Activity size={16} color="#3b82f6" />{t('costAnalysis.momGrowthRanking')}</div>
              <SimpleHorizontalBarChart data={DEPT_REVENUE_DATA.sort((a, b) => b.momGrowth - a.momGrowth).map(d => ({ label: d.deptName, value: d.momGrowth, color: d.momGrowth >= 0 ? '#22c55e' : '#ef4444' }))} height={160} />
            </div>
          </div>

          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20 }}>
            <div style={sectionTitleStyle}><PieChartIcon size={16} color="#8b949e" />{t('costAnalysis.deptRevenueShareAnalysis')}</div>
            <SimplePieChart data={deptRevenueStats.sorted.map(d => ({ label: d.deptName, value: d.monthlyProfit, color: d.modality === 'CT' ? '#3b82f6' : d.modality === 'MRI' ? '#8b5cf6' : d.modality === 'DSA' ? '#f59e0b' : '#22c55e' }))} size={150} />
          </div>
        </div>
      )}

      {activeTab === 'drg' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            <CostCard title={t("costAnalysis.drgGroupCount")} value={DRG_DATA.length.toString()} subtitle="涉及分组" icon={Hash} color="#3b82f6" />
            <CostCard title={t("costAnalysis.avgCost")} value={`¥${(DRG_DATA.reduce((s, d) => s + d.cost, 0) / DRG_DATA.length).toLocaleString()}`} subtitle="每分组平均" icon={DollarSign} color="#ef4444" />
            <CostCard title={t("costAnalysis.vsNationalAvg")} value={formatPercent(((DRG_DATA.reduce((s, d) => s + d.cost, 0) / DRG_DATA.length) / (DRG_DATA.reduce((s, d) => s + d.nationalAvgCost, 0) / DRG_DATA.length) - 1) * 100)} subtitle="本院/全国" icon={TrendingDown} color="#f59e0b" />
            <CostCard title={t("costAnalysis.classAGroup")} value={DRG_DATA.filter(d => d.level === 'A').length.toString()} subtitle="高权重分组" icon={Award} color="#22c55e" />
          </div>

          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20 }}>
            <div style={sectionTitleStyle}><BarChart3 size={16} color="#3b82f6" /> {t('costAnalysis.hospitalCostVsNationalAvg')}</div>
            <ChartContainer height={280} state={DRG_DATA.length === 0 ? 'empty' : 'ready'} emptyDescription={t('costAnalysis.noDrgData')}>
              <ChartBar data={DRG_DATA.map(d => ({ name: d.code.slice(0, 7), 本院费用: d.cost / 10000, 全国平均: d.nationalAvgCost / 10000 }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#8b949e' }} />
                <YAxis tick={{ fontSize: 12, fill: '#8b949e' }} tickFormatter={(v: number) => `${v}万`} />
                <Tooltip contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 6, fontSize: 12 }} formatter={(v: number) => [`¥${(v * 10000).toLocaleString()}`, '']} />
                <Legend />
                <Bar dataKey="本院费用" fill="#ef4444" radius={[4, 4, 0, 0]} />
                <Bar dataKey="全国平均" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </ChartBar>
            </ChartContainer>
          </div>

          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #30363d', fontSize: 14, fontWeight: 600, color: '#f0f6fc' }}>{t('costAnalysis.drgDipGroupDetail')}</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#21262d' }}>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 12, color: '#8b949e', fontWeight: 600 }}>{t('costAnalysis.drgCode')}</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 12, color: '#8b949e', fontWeight: 600 }}>{t('costAnalysis.name')}</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: '#8b949e', fontWeight: 600 }}>{t('costAnalysis.weight')}</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12, color: '#8b949e', fontWeight: 600 }}>{t('costAnalysis.hospitalCost')}</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12, color: '#8b949e', fontWeight: 600 }}>{t('costAnalysis.nationalAverage')}</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12, color: '#8b949e', fontWeight: 600 }}>{t('costAnalysis.difference')}</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: '#8b949e', fontWeight: 600 }}>{t('costAnalysis.level')}</th>
                </tr>
              </thead>
              <tbody>
                {DRG_DATA.map((d, idx) => {
                  const diff = d.nationalAvgCost - d.cost
                  return (
                    <tr key={d.code} style={{ borderTop: '1px solid #21262d', background: idx % 2 === 0 ? '#0d1117' : '#161b22' }}>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: '#3b82f6', fontWeight: 500 }}>{d.code}</td>
                      <td style={{ padding: '10px 12px', fontSize: 13, color: '#f0f6fc' }}>{d.name}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 13, color: '#8b949e' }}>{d.weight}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: 13, color: '#f0f6fc' }}>¥{d.cost.toLocaleString()}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: 13, color: '#8b949e' }}>¥{d.nationalAvgCost.toLocaleString()}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: 13, fontWeight: 600, color: diff >= 0 ? '#22c55e' : '#ef4444' }}>{diff >= 0 ? '+' : ''}¥{diff.toLocaleString()}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <span style={{ padding: '2px 10px', borderRadius: 4, fontSize: 12, fontWeight: 600, background: d.level === 'A' ? '#22c55e20' : d.level === 'B' ? '#f59e0b20' : '#3b82f620', color: d.level === 'A' ? '#22c55e' : d.level === 'B' ? '#f59e0b' : '#3b82f6' }}>{d.level}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'breakeven' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {BREAK_EVEN_DATA.devices.map(d => {
              const bep = Math.ceil(d.fixedCost / (d.revenuePerExam - d.variableCostPerExam))
              const actualExams = d.monthlyExams
              const isProfitable = actualExams > bep
              return (
                <div key={d.name} style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#f0f6fc', marginBottom: 12 }}>{d.name}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12, color: '#8b949e' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('costAnalysis.fixedCostPerMonth')}</span><span style={{ color: '#f0f6fc' }}>¥{d.fixedCost.toLocaleString()}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('costAnalysis.variableCostPerExam')}</span><span style={{ color: '#f0f6fc' }}>¥{d.variableCostPerExam}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('costAnalysis.revenuePerExam')}</span><span style={{ color: '#22c55e' }}>¥{d.revenuePerExam.toLocaleString()}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('costAnalysis.breakEvenPoint')}</span><span style={{ color: '#f59e0b', fontWeight: 600 }}>{bep}例/月</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('costAnalysis.actualExamVolume')}</span><span style={{ color: actualExams > bep ? '#22c55e' : '#ef4444', fontWeight: 600 }}>{actualExams}例/月</span></div>
                    <div style={{ marginTop: 8, padding: 8, borderRadius: 6, background: isProfitable ? '#22c55e20' : '#ef444420', textAlign: 'center', fontSize: 13, fontWeight: 600, color: isProfitable ? '#22c55e' : '#ef4444' }}>{isProfitable ? t('costAnalysis.profitable') : t('costAnalysis.loss')}</div>
                  </div>
                </div>
              )
            })}
          </div>

          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20 }}>
            <div style={sectionTitleStyle}><BarChart3 size={16} color="#3b82f6" /> {t('costAnalysis.monthlyRevenueCostTrend')}</div>
            <ChartContainer height={280} state={BREAK_EVEN_DATA.monthlyTrend.length === 0 ? 'empty' : 'ready'} emptyDescription={t('costAnalysis.noBreakEvenTrend')}>
              <ChartBar data={BREAK_EVEN_DATA.monthlyTrend.map(m => ({ month: m.month.slice(5), CT收入: m.ctRevenue / 10000, CT成本: m.ctCost / 10000, MR收入: m.mrRevenue / 10000, MR成本: m.mrCost / 10000 }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#8b949e' }} />
                <YAxis tick={{ fontSize: 12, fill: '#8b949e' }} tickFormatter={(v: number) => `${v}万`} />
                <Tooltip contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 6 }} formatter={(v: number) => [`¥${(v * 10000).toLocaleString()}`, '']} />
                <Legend />
                <Bar dataKey="CT收入" fill="#22c55e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="CT成本" fill="#ef4444" radius={[4, 4, 0, 0]} />
                <Bar dataKey="MR收入" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="MR成本" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </ChartBar>
            </ChartContainer>
          </div>
        </div>
      )}

      {activeTab === 'insurance' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            <CostCard title={t("costAnalysis.medicalInsurancePayment")} value={`¥${(INSURANCE_ALLOCATION.currentMonth.filter(i => i.type === '医保').reduce((s, i) => s + i.value, 0)).toLocaleString()}`} subtitle="职工+城乡居民" icon={Landmark} color="#3b82f6" />
            <CostCard title={t("costAnalysis.commercialInsurancePayment")} value={`¥${INSURANCE_ALLOCATION.currentMonth.filter(i => i.type === '商保').reduce((s, i) => s + i.value, 0).toLocaleString()}`} subtitle="商业保险" icon={ShieldBan} color="#059669" />
            <CostCard title={t("costAnalysis.selfPayPayment")} value={`¥${INSURANCE_ALLOCATION.currentMonth.filter(i => i.type === '自费').reduce((s, i) => s + i.value, 0).toLocaleString()}`} subtitle="患者自费" icon={Wallet} color="#d97706" />
            <CostCard title={t("costAnalysis.medicalInsuranceRatio")} value={formatPercent((INSURANCE_ALLOCATION.currentMonth.filter(i => i.type === '医保').reduce((s, i) => s + i.value, 0) / INSURANCE_ALLOCATION.currentMonth.reduce((s, i) => s + i.value, 0)) * 100)} subtitle="支付方占比" icon={Percent} color="#22c55e" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20 }}>
              <div style={sectionTitleStyle}><PieChartIcon size={16} color="#8b949e" /> {t('costAnalysis.currentMonthPayerComposition')}</div>
              <SimplePieChart data={INSURANCE_ALLOCATION.currentMonth.map(i => ({ label: i.name, value: i.value / 10000, color: i.color }))} size={130} />
            </div>
            <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20 }}>
              <div style={sectionTitleStyle}><BarChart3 size={16} color="#3b82f6" /> {t('costAnalysis.payerTrendWan')}</div>
              <ChartContainer height={220} state={INSURANCE_ALLOCATION.monthlyTrend.length === 0 ? 'empty' : 'ready'} emptyDescription={t('costAnalysis.noPayerTrend')}>
                <LineChart data={INSURANCE_ALLOCATION.monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#8b949e' }} tickFormatter={(v: string) => v.slice(5)} />
                  <YAxis tick={{ fontSize: 12, fill: '#8b949e' }} tickFormatter={(v: number) => `${v}万`} />
                  <Tooltip contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 6 }} />
                  <Legend />
                  <Line type="monotone" dataKey="medicalInsurance" name={t('costAnalysis.medicalInsurance')} stroke="#3b82f6" strokeWidth={2} />
                  <Line type="monotone" dataKey="commercial" name={t('costAnalysis.commercialInsurance')} stroke="#059669" strokeWidth={2} />
                  <Line type="monotone" dataKey="selfPay" name={t('costAnalysis.selfPay')} stroke="#d97706" strokeWidth={2} />
                </LineChart>
              </ChartContainer>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'budget' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            <CostCard title={t("costAnalysis.annualBudget")} value={`¥${BUDGET_DATA.ytd.budget.toLocaleString()}`} subtitle="YTD预算" icon={ClipboardList} color="#3b82f6" />
            <CostCard title={t("costAnalysis.actualExpenditure")} value={`¥${BUDGET_DATA.ytd.actual.toLocaleString()}`} subtitle="YTD实际" icon={DollarSign} color={BUDGET_DATA.ytd.variance > 0 ? '#ef4444' : '#22c55e'} />
            <CostCard title={t("costAnalysis.surplusOrDeficit")} value={`¥${Math.abs(BUDGET_DATA.ytd.variance).toLocaleString()}`} subtitle={BUDGET_DATA.ytd.variance > 0 ? '超支' : '结余'} icon={TrendingUp} color={BUDGET_DATA.ytd.variance > 0 ? '#ef4444' : '#22c55e'} />
            <CostCard title={t("costAnalysis.deviationRate")} value={formatPercent(BUDGET_DATA.ytd.varianceRate)} subtitle="差异%" icon={Percent} color={BUDGET_DATA.ytd.varianceRate > 5 ? '#ef4444' : BUDGET_DATA.ytd.varianceRate > 2 ? '#f59e0b' : '#22c55e'} />
          </div>

          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20 }}>
            <div style={sectionTitleStyle}><BarChart3 size={16} color="#3b82f6" /> {t('costAnalysis.monthlyBudgetVsActual')}</div>
            <ChartContainer height={260} state={BUDGET_DATA.monthly.length === 0 ? 'empty' : 'ready'} emptyDescription={t('costAnalysis.noBudgetData')}>
              <ChartBar data={BUDGET_DATA.monthly.map(m => ({ month: m.month.slice(5), 预算: m.budget / 10000, 实际: m.actual / 10000 }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#8b949e' }} />
                <YAxis tick={{ fontSize: 12, fill: '#8b949e' }} tickFormatter={(v: number) => `${v}万`} />
                <Tooltip contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 6 }} formatter={(v: number) => [`¥${(v * 10000).toLocaleString()}`, '']} />
                <Legend />
                <Bar dataKey="预算" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="实际" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </ChartBar>
            </ChartContainer>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20 }}>
              <div style={sectionTitleStyle}><List size={16} color="#8b949e" /> {t('costAnalysis.categoryBudgetExecution')}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {BUDGET_DATA.categories.map(c => {
                  const rate = ((c.actual - c.budget) / c.budget) * 100
                  const isOver = rate > 10
                  return (
                    <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid #21262d' }}>
                      <span style={{ fontSize: 12, color: '#f0f6fc', width: 100 }}>{c.name}</span>
                      <div style={{ flex: 1, height: 8, background: '#21262d', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ width: `${(c.actual / c.budget) * 100}%`, height: '100%', background: isOver ? '#ef4444' : '#22c55e', borderRadius: 4 }} />
                      </div>
                      <span style={{ fontSize: 12, width: 40, textAlign: 'right', color: isOver ? '#ef4444' : '#22c55e' }}>{rate > 0 ? '+' : ''}{rate.toFixed(1)}%</span>
                      <span style={{ fontSize: 12, color: '#8b949e', width: 70, textAlign: 'right' }}>¥{c.actual.toLocaleString()}</span>
                    </div>
                  )
                })}
              </div>
            </div>
            <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20 }}>
              <div style={sectionTitleStyle}><AlertTriangle size={16} color="#ef4444" /> {t('costAnalysis.budgetOverrunWarning')}</div>
              {BUDGET_DATA.monthly.filter(m => m.varianceRate > 5).length === 0 ? (
                <div style={{ color: '#22c55e', fontSize: 13 }}>{t('costAnalysis.allMonthsGood')}</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {BUDGET_DATA.monthly.filter(m => m.varianceRate > 5).map(m => (
                    <div key={m.month} style={{ padding: 8, background: '#ef444420', borderRadius: 6, fontSize: 12 }}>
                      <span style={{ color: '#f0f6fc' }}>{m.month}: </span>
                      <span style={{ color: '#ef4444', fontWeight: 600 }}>{t('costAnalysis.overBudget')}{m.varianceRate.toFixed(1)}%</span>
                      <span style={{ color: '#8b949e', marginLeft: 8 }}>(+¥{m.variance.toLocaleString()})</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'pl' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            <CostCard title={t("costAnalysis.monthlyRevenueLabel")} value={`¥${PL_DATA.currentMonth.revenue.toLocaleString()}`} subtitle="总收入" icon={TrendingUp} color="#22c55e" />
            <CostCard title={t("costAnalysis.monthlyCostLabel")} value={`¥${PL_DATA.currentMonth.cost.toLocaleString()}`} subtitle="总成本" icon={DollarSign} color="#ef4444" />
            <CostCard title={t("costAnalysis.grossProfit")} value={`¥${PL_DATA.currentMonth.grossProfit.toLocaleString()}`} subtitle={`毛利率 ${((PL_DATA.currentMonth.grossProfit / PL_DATA.currentMonth.revenue) * 100).toFixed(1)}%`} icon={Wallet} color="#f59e0b" />
            <CostCard title={t("costAnalysis.netProfit")} value={`¥${PL_DATA.currentMonth.netIncome.toLocaleString()}`} subtitle={`净利率 ${PL_DATA.currentMonth.profitRate}%`} icon={Award} color="#22c55e" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20 }}>
              <div style={sectionTitleStyle}><List size={16} color="#8b949e" /> {t('costAnalysis.monthlyPLDetail')}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {PL_DATA.breakdown.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: idx < PL_DATA.breakdown.length - 1 ? '1px solid #21262d' : 'none', fontSize: 12 }}>
                    <span style={{ color: '#f0f6fc' }}>{item.item}</span>
                    <span style={{ color: item.amount >= 0 ? '#22c55e' : '#ef4444', fontWeight: 600 }}>{item.amount >= 0 ? '+' : ''}¥{item.amount.toLocaleString()}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', fontSize: 14, fontWeight: 700, borderTop: '2px solid #30363d', marginTop: 4 }}>
                  <span style={{ color: '#f0f6fc' }}>{t('costAnalysis.netProfit')}</span>
                  <span style={{ color: PL_DATA.currentMonth.netIncome >= 0 ? '#22c55e' : '#ef4444' }}>¥{PL_DATA.currentMonth.netIncome.toLocaleString()}</span>
                </div>
              </div>
            </div>
            <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20 }}>
              <div style={sectionTitleStyle}><BarChart3 size={16} color="#3b82f6" /> {t('costAnalysis.monthlyPLTrend')}</div>
              <ChartContainer height={280} state={PL_DATA.monthly.length === 0 ? 'empty' : 'ready'} emptyDescription={t('costAnalysis.noPlTrend')}>
                <ChartBar data={PL_DATA.monthly.map(m => ({ month: m.month.slice(5), 收入: m.revenue / 10000, 成本: m.cost / 10000, 毛利: m.grossProfit / 10000, 净利: m.netIncome / 10000 }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#8b949e' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#8b949e' }} tickFormatter={(v: number) => `${v}万`} />
                  <Tooltip contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 6 }} formatter={(v: number) => [`¥${(v * 10000).toLocaleString()}`, '']} />
                  <Legend />
                  <Bar dataKey="收入" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="成本" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="毛利" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="净利" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </ChartBar>
              </ChartContainer>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'claims' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            <CostCard title={t("costAnalysis.claimTotal")} value={CLAIMS_DATA.claims.length.toString()} subtitle="本月" icon={FileText} color="#3b82f6" />
            <CostCard title={t("costAnalysis.approved")} value={CLAIMS_DATA.claims.filter(c => c.status === '已通过').length.toString()} subtitle="理赔成功" icon={CheckCircle} color="#22c55e" />
            <CostCard title={t("costAnalysis.rejected")} value={CLAIMS_DATA.claims.filter(c => c.status === '已拒绝').length.toString()} subtitle="需处理" icon={XCircle} color="#ef4444" />
            <CostCard title={t("costAnalysis.appealing")} value={CLAIMS_DATA.claims.filter(c => c.status === '申诉中').length.toString()} subtitle="待跟进" icon={MessageSquare} color="#f59e0b" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #30363d', fontSize: 14, fontWeight: 600, color: '#f0f6fc' }}>{t('costAnalysis.claimList')}</div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#21262d' }}>
                    <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 12, color: '#8b949e' }}>{t('costAnalysis.claimNo')}</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 12, color: '#8b949e' }}>{t('costAnalysis.patient')}</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 12, color: '#8b949e' }}>{t('costAnalysis.type')}</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right', fontSize: 12, color: '#8b949e' }}>{t('costAnalysis.amount')}</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center', fontSize: 12, color: '#8b949e' }}>{t('costAnalysis.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {CLAIMS_DATA.claims.map((c, idx) => {
                    const statusColor = c.status === '已通过' ? '#22c55e' : c.status === '已拒绝' ? '#ef4444' : c.status === '申诉中' ? '#f59e0b' : '#3b82f6'
                    return (
                      <tr key={c.id} style={{ borderTop: '1px solid #21262d', background: idx % 2 === 0 ? '#0d1117' : '#161b22' }}>
                        <td style={{ padding: '8px 10px', fontSize: 12, color: '#3b82f6' }}>{c.id}</td>
                        <td style={{ padding: '8px 10px', fontSize: 13, color: '#f0f6fc' }}>{c.patientName}</td>
                        <td style={{ padding: '8px 10px', fontSize: 12, color: '#8b949e' }}>{c.type}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: 13, color: '#f0f6fc' }}>¥{c.amount.toLocaleString()}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                          <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 500, background: `${statusColor}20`, color: statusColor }}>{c.status}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <div style={{ padding: '12px 16px', borderTop: '1px solid #30363d', display: 'flex', gap: 8 }}>
                <button onClick={handleExportClaims837} style={{ padding: '6px 14px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 4, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}><Download size={14} /> {t('costAnalysis.generate837')}</button>
                <button onClick={() => void loadFinance()} style={{ padding: '6px 14px', background: '#21262d', color: '#8b949e', border: '1px solid #30363d', borderRadius: 4, fontSize: 12, cursor: 'pointer' }}><RefreshCw size={14} style={{ marginRight: 4 }} />{t('costAnalysis.refresh')}</button>
              </div>
            </div>
            <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20 }}>
              <div style={sectionTitleStyle}><Ban size={16} color="#ef4444" /> {t('costAnalysis.claimDenialReasonAnalysis')}</div>
              <SimpleHorizontalBarChart data={CLAIMS_DATA.denialReasons.map(r => ({ label: r.reason, value: r.count, color: '#ef4444' }))} height={180} />
              <div style={{ marginTop: 16, padding: 12, background: '#21262d', borderRadius: 6 }}>
                <div style={{ fontSize: 12, color: '#8b949e', marginBottom: 8 }}>{t('costAnalysis.appealProcess')}</div>
                <div style={{ display: 'flex', gap: 8, fontSize: 12, color: '#f0f6fc' }}>
                  <span style={{ padding: '4px 8px', background: '#3b82f620', borderRadius: 4, color: '#3b82f6' }}>{t('costAnalysis.appealStep1')}</span>
                  <ArrowRight size={14} style={{ color: '#8b949e', alignSelf: 'center' }} />
                  <span style={{ padding: '4px 8px', background: '#f59e0b20', borderRadius: 4, color: '#f59e0b' }}>{t('costAnalysis.appealStep2')}</span>
                  <ArrowRight size={14} style={{ color: '#8b949e', alignSelf: 'center' }} />
                  <span style={{ padding: '4px 8px', background: '#22c55e20', borderRadius: 4, color: '#22c55e' }}>{t('costAnalysis.appealStep3')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
