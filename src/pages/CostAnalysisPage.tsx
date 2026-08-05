import { useState, useMemo } from 'react'
import {
  TrendingUp, TrendingDown, DollarSign, Monitor, Users, Film,
  Calendar, BarChart3, PieChart as PieChartIcon, Activity,
  Server, Clock, Scissors, HeartPulse,
  Package, Percent, Award, Wallet, FileText, ClipboardList, AlertTriangle,
  CheckCircle, XCircle, Ban, Send, RefreshCw, Landmark, BadgePercent,
  Hash, List, FileSpreadsheet, Gavel, ShieldBan, MessageSquare, ArrowRight
} from 'lucide-react'
import {
  BarChart as ChartBar, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LineChart, Line
} from 'recharts'
import { CostFilter, CostOverview } from './cost'
import { CostCard, SimplePieChart, SimpleBarChart, SimpleHorizontalBarChart } from './cost/CostChart'
import {
  EquipmentRow, ConsumableRow, LaborRow, MedicalConsumableRow,
  DepreciationRow, ProfitMarginRow, DeptRevenueRow
} from './cost/CostTable'
import {
  type TimeRange, type TabType,
  EQUIPMENT_DATA, CONSUMABLE_DATA, LABOR_DATA, BENEFIT_DATA,
  MEDICAL_CONSUMABLE_DATA, DEPT_CONSUMABLE_DATA,
  DEPRECIATION_DATA, EXAM_PROFIT_MARGIN_DATA, DEPT_REVENUE_DATA,
  DRG_DATA, BREAK_EVEN_DATA, INSURANCE_ALLOCATION,
  BUDGET_DATA, PL_DATA, CLAIMS_DATA,
  formatCurrency, formatPercent, PRIMARY, calculateUnitCost,
} from './cost'

export default function CostAnalysisPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>('year')
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [loading] = useState(false)
  const [error] = useState<string | null>(null)

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

  if (loading) return <div role="status" data-testid="cost-loading" style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>加载中...</div>;
  if (error) return <div role="alert" data-testid="cost-error" style={{ padding: 40, textAlign: 'center', color: '#dc2626' }}>{error}</div>;
  if (!EQUIPMENT_DATA || EQUIPMENT_DATA.length === 0) {
    return (
      <div data-testid="cost-empty" style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
        <div style={{ fontSize: 14, marginBottom: 12 }}>暂无设备成本数据</div>
        <div style={{ fontSize: 12, color: '#64748b' }}>请检查日期范围或导入设备台账后重试</div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <CostFilter activeTab={activeTab} onTabChange={setActiveTab} timeRange={timeRange} onTimeRangeChange={setTimeRange} />

      {activeTab === 'overview' && <CostOverview />}

      {activeTab === 'equipment' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <CostCard title="设备总资产" value={formatCurrency(EQUIPMENT_DATA.reduce((s, e) => s + e.purchasePrice, 0))} subtitle={`${EQUIPMENT_DATA.length} 台设备`} icon={Server} color="#3b82f6" />
            <CostCard title="年维护费用" value={formatCurrency(EQUIPMENT_DATA.reduce((s, e) => s + e.annualMaintenance, 0))} subtitle="年度维保支出" icon={Activity} color="#f59e0b" />
            <CostCard title="年检查总量" value={EQUIPMENT_DATA.reduce((s, e) => s + e.annualUsage, 0).toLocaleString()} subtitle="合计检查人次" icon={Monitor} color="#22c55e" />
          </div>
          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20 }}>
            <div style={sectionTitleStyle}><Server size={16} color="#3b82f6" />设备成本明细</div>
            <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 80px 100px 100px 100px 100px', gap: 8, padding: '8px 16px', background: '#21262d', borderBottom: '1px solid #30363d', fontSize: 12, fontWeight: 600, color: '#8b949e' }}>
              <span>#</span><span>设备名称</span><span>类型</span><span>采购价(万)</span><span>年成本(万)</span><span>年检查量</span><span>单次成本</span>
            </div>
            {equipmentWithUnitCost.map((eq, idx) => (<EquipmentRow key={eq.id} equipment={eq} index={idx} />))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20 }}>
              <div style={sectionTitleStyle}><Monitor size={16} color="#3b82f6" />设备类型分布</div>
              <SimplePieChart data={[
                { label: 'CT设备', value: EQUIPMENT_DATA.filter(e => e.modality === 'CT').reduce((s, e) => s + e.purchasePrice, 0), color: '#3b82f6' },
                { label: 'MRI设备', value: EQUIPMENT_DATA.filter(e => e.modality === 'MRI').reduce((s, e) => s + e.purchasePrice, 0), color: '#8b5cf6' },
                { label: 'DSA设备', value: EQUIPMENT_DATA.filter(e => e.modality === 'DSA').reduce((s, e) => s + e.purchasePrice, 0), color: '#f59e0b' },
              ]} size={120} />
            </div>
            <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20 }}>
              <div style={sectionTitleStyle}><Scissors size={16} color="#22c55e" />单次检查成本分布</div>
              <SimpleBarChart data={equipmentWithUnitCost.map(eq => ({ label: eq.modality, value: eq.unitCost, color: eq.modality === 'CT' ? '#3b82f6' : eq.modality === 'MRI' ? '#8b5cf6' : '#f59e0b' }))} height={160} />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'consumable' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            <CostCard title="胶片耗材" value={formatCurrency(CONSUMABLE_DATA.filter(c => c.category === '胶片').reduce((s, c) => s + c.annualCost, 0), true)} subtitle="X光胶片/打印片" icon={Film} color="#22c55e" />
            <CostCard title="对比剂" value={formatCurrency(CONSUMABLE_DATA.filter(c => c.category === '对比剂').reduce((s, c) => s + c.annualCost, 0), true)} subtitle="CT/MRI增强" icon={HeartPulse} color="#3b82f6" />
            <CostCard title="DSA耗材" value={formatCurrency(CONSUMABLE_DATA.filter(c => c.category === '耗材').reduce((s, c) => s + c.annualCost, 0), true)} subtitle="导管/介入耗材" icon={Activity} color="#f59e0b" />
            <CostCard title="耗材总计" value={formatCurrency(summaryData.totalConsumableCost)} subtitle={`${CONSUMABLE_DATA.length} 类耗材`} icon={Scissors} color="#ef4444" />
          </div>
          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20 }}>
            <div style={sectionTitleStyle}><Film size={16} color="#22c55e" />耗材明细</div>
            <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 80px 80px 100px 100px', gap: 8, padding: '8px 16px', background: '#21262d', borderBottom: '1px solid #30363d', fontSize: 12, fontWeight: 600, color: '#8b949e' }}>
              <span>#</span><span>名称</span><span>类别</span><span>单价</span><span>月用量</span><span>年成本</span>
            </div>
            {CONSUMABLE_DATA.map((item, idx) => (<ConsumableRow key={item.id} item={item} index={idx} />))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20 }}>
              <div style={sectionTitleStyle}><PieChartIcon size={16} color="#8b949e" />耗材类别占比</div>
              <SimplePieChart data={[
                { label: '胶片', value: CONSUMABLE_DATA.filter(c => c.category === '胶片').reduce((s, c) => s + c.annualCost, 0), color: '#22c55e' },
                { label: '对比剂', value: CONSUMABLE_DATA.filter(c => c.category === '对比剂').reduce((s, c) => s + c.annualCost, 0), color: '#3b82f6' },
                { label: '注射器', value: CONSUMABLE_DATA.filter(c => c.category === '注射器').reduce((s, c) => s + c.annualCost, 0), color: '#f59e0b' },
                { label: 'DSA耗材', value: CONSUMABLE_DATA.filter(c => c.category === '耗材').reduce((s, c) => s + c.annualCost, 0), color: '#ef4444' },
                { label: '其他', value: CONSUMABLE_DATA.filter(c => c.category === '其他').reduce((s, c) => s + c.annualCost, 0), color: '#8b949e' },
              ]} size={130} />
            </div>
            <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20 }}>
              <div style={sectionTitleStyle}><BarChart3 size={16} color="#3b82f6" />主要耗材成本排序</div>
              <SimpleBarChart data={CONSUMABLE_DATA.sort((a, b) => b.annualCost - a.annualCost).slice(0, 6).map(c => ({ label: c.category, value: c.annualCost, color: c.category === '胶片' ? '#22c55e' : c.category === '对比剂' ? '#3b82f6' : c.category === '耗材' ? '#ef4444' : '#f59e0b' }))} height={160} />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'labor' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            <CostCard title="技师人力" value={formatCurrency(laborWithWorkload.filter(l => l.role.includes('技师')).reduce((s, l) => s + l.annualCost, 0), true)} subtitle={`${laborWithWorkload.filter(l => l.role.includes('技师')).reduce((s, l) => s + l.count, 0)} 人`} icon={Users} color="#3b82f6" />
            <CostCard title="护士人力" value={formatCurrency(laborWithWorkload.filter(l => l.role.includes('护士')).reduce((s, l) => s + l.annualCost, 0), true)} subtitle={`${laborWithWorkload.filter(l => l.role.includes('护士')).reduce((s, l) => s + l.count, 0)} 人`} icon={Users} color="#22c55e" />
            <CostCard title="医师人力" value={formatCurrency(laborWithWorkload.filter(l => l.role.includes('医师')).reduce((s, l) => s + l.annualCost, 0), true)} subtitle={`${laborWithWorkload.filter(l => l.role.includes('医师')).reduce((s, l) => s + l.count, 0)} 人`} icon={Users} color="#f59e0b" />
            <CostCard title="人力总成本" value={formatCurrency(summaryData.totalLaborCost)} subtitle={`${LABOR_DATA.reduce((s, l) => s + l.count, 0)} 人`} icon={DollarSign} color="#ef4444" />
          </div>
          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20 }}>
            <div style={sectionTitleStyle}><Users size={16} color="#3b82f6" />人力成本明细</div>
            <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 60px 100px 100px 100px', gap: 8, padding: '8px 16px', background: '#21262d', borderBottom: '1px solid #30363d', fontSize: 12, fontWeight: 600, color: '#8b949e' }}>
              <span>#</span><span>岗位</span><span>人数</span><span>月薪(元)</span><span>年成本(元)</span><span>人均年检查</span>
            </div>
            {laborWithWorkload.map((item, idx) => (<LaborRow key={item.id} item={item} index={idx} />))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20 }}>
              <div style={sectionTitleStyle}><PieChartIcon size={16} color="#8b949e" />人力成本岗位占比</div>
              <SimplePieChart data={[
                { label: '放射技师', value: laborWithWorkload.filter(l => l.role.includes('技师')).reduce((s, l) => s + l.annualCost, 0), color: '#3b82f6' },
                { label: '护士', value: laborWithWorkload.filter(l => l.role.includes('护士')).reduce((s, l) => s + l.annualCost, 0), color: '#22c55e' },
                { label: '放射医师', value: laborWithWorkload.filter(l => l.role.includes('医师')).reduce((s, l) => s + l.annualCost, 0), color: '#f59e0b' },
                { label: '行政辅助', value: laborWithWorkload.filter(l => !l.role.includes('技师') && !l.role.includes('护士') && !l.role.includes('医师')).reduce((s, l) => s + l.annualCost, 0), color: '#8b949e' },
              ]} size={130} />
            </div>
            <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20 }}>
              <div style={sectionTitleStyle}><BarChart3 size={16} color="#22c55e" />各岗位年均成本</div>
              <SimpleBarChart data={[
                { label: 'CT技师', value: laborWithWorkload.find(l => l.id === 'tech-ct')?.annualCost || 0, color: '#3b82f6' },
                { label: 'MRI技师', value: laborWithWorkload.find(l => l.id === 'tech-mri')?.annualCost || 0, color: '#8b5cf6' },
                { label: 'DSA技师', value: laborWithWorkload.find(l => l.id === 'tech-dsa')?.annualCost || 0, color: '#f59e0b' },
                { label: '医师', value: laborWithWorkload.find(l => l.id === 'physician')?.annualCost || 0, color: '#22c55e' },
              ]} height={160} />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'benefit' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            <CostCard title="年度总收入" value={formatCurrency(BENEFIT_DATA.reduce((s, b) => s + b.revenue, 0))} subtitle="近12个月累计" icon={TrendingUp} trend="up" trendValue="+18.2%" color="#22c55e" />
            <CostCard title="年度总成本" value={formatCurrency(BENEFIT_DATA.reduce((s, b) => s + b.cost, 0))} subtitle="近12个月累计" icon={DollarSign} color="#ef4444" />
            <CostCard title="年度总利润" value={formatCurrency(BENEFIT_DATA.reduce((s, b) => s + b.profit, 0))} subtitle="收入-成本" icon={TrendingUp} trend="up" trendValue="+22.5%" color="#22c55e" />
            <CostCard title="利润率" value={formatPercent((BENEFIT_DATA.reduce((s, b) => s + b.profit, 0) / BENEFIT_DATA.reduce((s, b) => s + b.revenue, 0)) * 100)} subtitle="利润/收入" icon={BarChart3} color="#3b82f6" />
          </div>

          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20 }}>
            <div style={sectionTitleStyle}><BarChart3 size={16} color="#3b82f6" />月度收入 vs 成本趋势</div>
            <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 12, height: 12, borderRadius: 2, background: '#22c55e' }} />
                <span style={{ fontSize: 12, color: '#8b949e' }}>收入</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 12, height: 12, borderRadius: 2, background: '#ef4444' }} />
                <span style={{ fontSize: 12, color: '#8b949e' }}>成本</span>
              </div>
            </div>
            <SimpleBarChart data={BENEFIT_DATA.map(b => ({ label: b.month.slice(5), value: b.revenue, color: '#22c55e' }))} height={200} />
            <div style={{ marginTop: 12 }}>
              <SimpleBarChart data={BENEFIT_DATA.map(b => ({ label: b.month.slice(5), value: b.cost, color: '#ef4444' }))} height={200} />
            </div>
          </div>

          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20 }}>
            <div style={sectionTitleStyle}><TrendingUp size={16} color="#22c55e" />月度利润趋势</div>
            <SimpleBarChart data={BENEFIT_DATA.map(b => ({ label: b.month.slice(5), value: b.profit, color: '#22c55e' }))} height={200} />
          </div>

          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20 }}>
            <div style={sectionTitleStyle}><Activity size={16} color="#8b949e" />月度效益明细</div>
            <div style={{ display: 'grid', gridTemplateColumns: '80px 100px 100px 100px 100px', gap: 8, padding: '8px 16px', background: '#21262d', borderBottom: '1px solid #30363d', fontSize: 12, fontWeight: 600, color: '#8b949e' }}>
              <span>月份</span><span>收入(万)</span><span>成本(万)</span><span>利润(万)</span><span>检查量</span>
            </div>
            {BENEFIT_DATA.map((item, idx) => {
              const profitRate = (item.profit / item.revenue) * 100
              return (
                <div key={item.month} style={{ display: 'grid', gridTemplateColumns: '80px 100px 100px 100px 100px', gap: 8, padding: '12px 16px', borderBottom: '1px solid #21262d', background: idx % 2 === 0 ? '#0d1117' : '#161b22', alignItems: 'center' }}>
                  <span style={{ color: '#8b949e', fontSize: 13 }}>{item.month}</span>
                  <span style={{ color: '#22c55e', fontSize: 13 }}>{formatCurrency(item.revenue)}</span>
                  <span style={{ color: '#ef4444', fontSize: 13 }}>{formatCurrency(item.cost)}</span>
                  <span style={{ color: '#22c55e', fontSize: 13, fontWeight: 600 }}>{formatCurrency(item.profit)}</span>
                  <span style={{ color: '#f0f6fc', fontSize: 13 }}>{item.examCount.toLocaleString()}<span style={{ color: '#6e7681', fontSize: 12, marginLeft: 4 }}>({profitRate > 0 ? '+' : ''}{profitRate.toFixed(1)}%)</span></span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {activeTab === 'medicalConsumable' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            <CostCard title="CT增强卫材" value={formatCurrency(medicalConsumableByType.ctTotal / 10000, true)} subtitle="对比剂/注射器/针管" icon={Package} color="#3b82f6" />
            <CostCard title="MR增强卫材" value={formatCurrency(medicalConsumableByType.mrTotal / 10000, true)} subtitle="钆剂/注射器" icon={Package} color="#8b5cf6" />
            <CostCard title="DSA卫材" value={formatCurrency(medicalConsumableByType.dsaTotal / 10000, true)} subtitle="导管/支架/造影剂" icon={Package} color="#f59e0b" />
            <CostCard title="卫材总计" value={formatCurrency((medicalConsumableByType.ctTotal + medicalConsumableByType.mrTotal + medicalConsumableByType.dsaTotal) / 10000, true)} subtitle="年消耗成本" icon={Wallet} color="#ef4444" />
          </div>

          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20 }}>
            <div style={sectionTitleStyle}><Package size={16} color="#22c55e" />检查项目卫材消耗明细</div>
            {(['CT增强', 'MR增强', 'DSA'] as const).map(type => {
              const typeColor = type === 'CT增强' ? '#3b82f6' : type === 'MR增强' ? '#8b5cf6' : '#f59e0b'
              const items = type === 'CT增强' ? medicalConsumableByType.ctItems : type === 'MR增强' ? medicalConsumableByType.mrItems : medicalConsumableByType.dsaItems
              return (
                <div key={type} style={{ marginBottom: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, padding: '8px 12px', background: `${typeColor}20`, borderRadius: 6, borderLeft: `3px solid ${typeColor}` }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: typeColor }}>{type}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '40px 80px 1fr 80px 80px 100px 120px', gap: 8, padding: '8px 16px', background: '#21262d', borderBottom: '1px solid #30363d', fontSize: 12, fontWeight: 600, color: '#8b949e' }}>
                    <span>#</span><span>类型</span><span>项目名称</span><span>单位</span><span>单价(元)</span><span>月用量</span><span>年成本(元)</span>
                  </div>
                  {items.map((item, idx) => (<MedicalConsumableRow key={item.id} item={item} index={idx} />))}
                </div>
              )
            })}
          </div>

          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20 }}>
            <div style={sectionTitleStyle}><Award size={16} color="#22c55e" />各科室卫材消耗排名</div>
            <div style={{ marginBottom: 16 }}>
              <SimpleHorizontalBarChart data={DEPT_CONSUMABLE_DATA.sort((a, b) => b.total - a.total).map(d => ({ label: d.deptName, value: d.total, color: d.modality === 'CT' ? '#3b82f6' : d.modality === 'MRI' ? '#8b5cf6' : d.modality === 'DSA' ? '#f59e0b' : '#22c55e' }))} height={180} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 80px 100px 100px 100px', gap: 8, padding: '8px 16px', background: '#21262d', borderBottom: '1px solid #30363d', fontSize: 12, fontWeight: 600, color: '#8b949e' }}>
              <span>#</span><span>科室</span><span>类型</span><span>CT卫材(万)</span><span>MR卫材(万)</span><span>DSA卫材(万)</span>
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
            <CostCard title="设备总原价" value={formatCurrency(DEPRECIATION_DATA.reduce((s, d) => s + d.purchasePrice, 0))} subtitle={`${DEPRECIATION_DATA.length} 台设备`} icon={Server} color="#3b82f6" />
            <CostCard title="年折旧总额" value={formatCurrency(depreciationStats.totalAnnual)} subtitle="当年折旧金额" icon={TrendingDown} color="#ef4444" />
            <CostCard title="累计折旧" value={formatCurrency(depreciationStats.totalAccumulated)} subtitle="已计提折旧" icon={Clock} color="#f59e0b" />
            <CostCard title="当前净值" value={formatCurrency(depreciationStats.totalBookValue)} subtitle="设备剩余价值" icon={Wallet} color="#22c55e" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20 }}>
              <div style={sectionTitleStyle}><Activity size={16} color="#3b82f6" />直线法折旧</div>
              <div style={{ fontSize: 12, color: '#8b949e', lineHeight: 1.6 }}>
                <p style={{ marginBottom: 8 }}>公式: (原价 - 残值) / 使用年限</p>
                <p>特点: 每期折旧额相同，设备账面值均匀下降</p>
              </div>
              <div style={{ marginTop: 16, padding: 12, background: '#21262d', borderRadius: 6 }}>
                <div style={{ fontSize: 12, color: '#f0f6fc' }}>年折旧总额: <span style={{ color: '#ef4444', fontWeight: 600 }}>{formatCurrency(depreciationStats.straightLineTotal)}</span></div>
              </div>
            </div>
            <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20 }}>
              <div style={sectionTitleStyle}><TrendingDown size={16} color="#8b5cf6" />双倍余额递减法</div>
              <div style={{ fontSize: 12, color: '#8b949e', lineHeight: 1.6 }}>
                <p style={{ marginBottom: 8 }}>公式: 2 × (1/使用年限) × 账面价值</p>
                <p>特点: 前期折旧高，后期转为直线法</p>
              </div>
              <div style={{ marginTop: 16, padding: 12, background: '#21262d', borderRadius: 6 }}>
                <div style={{ fontSize: 12, color: '#f0f6fc' }}>年折旧总额: <span style={{ color: '#8b5cf6', fontWeight: 600 }}>{formatCurrency(depreciationStats.doubleDecliningTotal)}</span></div>
              </div>
            </div>
          </div>

          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20 }}>
            <div style={sectionTitleStyle}><Server size={16} color="#22c55e" />设备折旧摊销明细</div>
            <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 80px 80px 80px 80px 100px 100px 100px', gap: 8, padding: '8px 16px', background: '#21262d', borderBottom: '1px solid #30363d', fontSize: 12, fontWeight: 600, color: '#8b949e' }}>
              <span>#</span><span>设备名称</span><span>类型</span><span>折旧方式</span><span>年限</span><span>原价(万)</span><span>月折旧(万)</span><span>年折旧(万)</span><span>当前净值(万)</span>
            </div>
            {DEPRECIATION_DATA.map((item, idx) => (<DepreciationRow key={item.id} item={item} index={idx} />))}
          </div>

          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20 }}>
            <div style={sectionTitleStyle}><Award size={16} color="#22c55e" />设备年折旧额排名</div>
            <SimpleHorizontalBarChart data={DEPRECIATION_DATA.sort((a, b) => b.annualDepreciation - a.annualDepreciation).map(d => ({ label: d.name.length > 12 ? d.name.slice(0, 12) + '...' : d.name, value: d.annualDepreciation, color: d.modality === 'CT' ? '#3b82f6' : d.modality === 'MRI' ? '#8b5cf6' : '#f59e0b' }))} height={160} />
          </div>
        </div>
      )}

      {activeTab === 'profitMargin' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            <CostCard title="检查项目数" value={EXAM_PROFIT_MARGIN_DATA.length.toString()} subtitle="全部项目" icon={BarChart3} color="#3b82f6" />
            <CostCard title="盈利项目" value={profitMarginStats.profitableCount.toString()} subtitle={`占比 ${((profitMarginStats.profitableCount / EXAM_PROFIT_MARGIN_DATA.length) * 100).toFixed(0)}%`} icon={TrendingUp} trend="up" color="#22c55e" />
            <CostCard title="亏损项目" value={profitMarginStats.lossMakingCount.toString()} subtitle="需重点关注" icon={TrendingDown} trend="down" color="#ef4444" />
            <CostCard title="月总利润" value={`¥${(profitMarginStats.totalMonthlyProfit / 10000).toFixed(1)}万`} subtitle="检查项目利润" icon={Wallet} color="#22c55e" />
          </div>

          {profitMarginStats.lossExams.length > 0 && (
            <div style={{ background: '#ef444420', border: '1px solid #ef4444', borderRadius: 8, padding: 20 }}>
              <div style={sectionTitleStyle}><TrendingDown size={16} color="#ef4444" />⚠️ 亏损项目预警</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 12 }}>
                {profitMarginStats.lossExams.map(exam => (
                  <div key={exam.id} style={{ background: '#161b22', borderRadius: 6, padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 13, color: '#f0f6fc', fontWeight: 500 }}>{exam.examName}</div>
                      <div style={{ fontSize: 12, color: '#8b949e' }}>{exam.modality} · {exam.monthlyCount}例/月</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 14, color: '#ef4444', fontWeight: 600 }}>-¥{Math.abs(exam.monthlyProfit).toLocaleString()}</div>
                      <div style={{ fontSize: 12, color: '#ef4444' }}>利润率: {exam.profitRate.toFixed(1)}%</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20 }}>
            <div style={sectionTitleStyle}><Percent size={16} color="#22c55e" />各检查项目成本利润率</div>
            <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 80px 90px 90px 90px 100px 100px', gap: 8, padding: '8px 16px', background: '#21262d', borderBottom: '1px solid #30363d', fontSize: 12, fontWeight: 600, color: '#8b949e' }}>
              <span>#</span><span>项目名称</span><span>类型</span><span>月检查量</span><span>收入(元)</span><span>成本(元)</span><span>利润率</span><span>月利润(元)</span>
            </div>
            {EXAM_PROFIT_MARGIN_DATA.sort((a, b) => b.profitRate - a.profitRate).map((item, idx) => (<ProfitMarginRow key={item.id} item={item} index={idx} />))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20 }}>
              <div style={sectionTitleStyle}><PieChartIcon size={16} color="#3b82f6" />利润率分布</div>
              <SimplePieChart data={[
                { label: '高利润率(>40%)', value: EXAM_PROFIT_MARGIN_DATA.filter(d => d.profitRate > 40 && !d.isLoss).reduce((s, d) => s + d.monthlyProfit, 0), color: '#22c55e' },
                { label: '中等利润率(20-40%)', value: EXAM_PROFIT_MARGIN_DATA.filter(d => d.profitRate >= 20 && d.profitRate <= 40 && !d.isLoss).reduce((s, d) => s + d.monthlyProfit, 0), color: '#3b82f6' },
                { label: '低利润率(<20%)', value: EXAM_PROFIT_MARGIN_DATA.filter(d => d.profitRate < 20 && d.profitRate > 0 && !d.isLoss).reduce((s, d) => s + d.monthlyProfit, 0), color: '#f59e0b' },
                { label: '亏损项目', value: Math.abs(EXAM_PROFIT_MARGIN_DATA.filter(d => d.isLoss).reduce((s, d) => s + d.monthlyProfit, 0)), color: '#ef4444' },
              ]} size={130} />
            </div>
            <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20 }}>
              <div style={sectionTitleStyle}><BarChart3 size={16} color="#22c55e" />项目利润排名</div>
              <SimpleHorizontalBarChart data={EXAM_PROFIT_MARGIN_DATA.sort((a, b) => b.monthlyProfit - a.monthlyProfit).slice(0, 5).map(d => ({ label: d.examName.length > 8 ? d.examName.slice(0, 8) + '...' : d.examName, value: Math.abs(d.monthlyProfit), color: d.isLoss ? '#ef4444' : '#22c55e' }))} height={160} />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'departmentRanking' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            <CostCard title="月总收入" value={formatCurrency(deptRevenueStats.totalRevenue)} subtitle="全科室合计" icon={TrendingUp} trend="up" trendValue="+8.5%" color="#22c55e" />
            <CostCard title="月总利润" value={formatCurrency(deptRevenueStats.totalProfit)} subtitle="全科室合计" icon={Wallet} trend="up" trendValue="+12.3%" color="#22c55e" />
            <CostCard title="平均利润率" value={formatPercent(deptRevenueStats.avgProfitRate)} subtitle="科室平均" icon={Percent} color="#3b82f6" />
            <CostCard title="参与排名科室" value={DEPT_REVENUE_DATA.length.toString()} subtitle="CT/MRI/DSA/普放" icon={Award} color="#f59e0b" />
          </div>

          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20 }}>
            <div style={sectionTitleStyle}><BarChart3 size={16} color="#22c55e" />各科室收益排名（柱状图）</div>
            <SimpleBarChart data={deptRevenueStats.sorted.map(d => ({ label: d.deptName, value: d.monthlyProfit, color: d.modality === 'CT' ? '#3b82f6' : d.modality === 'MRI' ? '#8b5cf6' : d.modality === 'DSA' ? '#f59e0b' : '#22c55e' }))} height={220} />
          </div>

          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20 }}>
            <div style={sectionTitleStyle}><Award size={16} color="#22c55e" />科室收益排名明细</div>
            <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 80px 90px 90px 90px 80px 90px 90px 90px', gap: 8, padding: '8px 16px', background: '#21262d', borderBottom: '1px solid #30363d', fontSize: 12, fontWeight: 600, color: '#8b949e' }}>
              <span>排名</span><span>科室</span><span>类型</span><span>检查量</span><span>月收入(万)</span><span>月成本(万)</span><span>月利润(万)</span><span>人均利润</span><span>同比</span><span>环比</span>
            </div>
            {deptRevenueStats.sorted.map((item, idx) => (<DeptRevenueRow key={item.deptId} item={item} index={idx} />))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20 }}>
              <div style={sectionTitleStyle}><TrendingUp size={16} color="#22c55e" />同比增长率排名</div>
              <SimpleHorizontalBarChart data={DEPT_REVENUE_DATA.sort((a, b) => b.yoyGrowth - a.yoyGrowth).map(d => ({ label: d.deptName, value: d.yoyGrowth, color: d.yoyGrowth >= 0 ? '#22c55e' : '#ef4444' }))} height={160} />
            </div>
            <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20 }}>
              <div style={sectionTitleStyle}><Activity size={16} color="#3b82f6" />环比增长率排名</div>
              <SimpleHorizontalBarChart data={DEPT_REVENUE_DATA.sort((a, b) => b.momGrowth - a.momGrowth).map(d => ({ label: d.deptName, value: d.momGrowth, color: d.momGrowth >= 0 ? '#22c55e' : '#ef4444' }))} height={160} />
            </div>
          </div>

          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20 }}>
            <div style={sectionTitleStyle}><PieChartIcon size={16} color="#8b949e" />科室收益占比分析</div>
            <SimplePieChart data={deptRevenueStats.sorted.map(d => ({ label: d.deptName, value: d.monthlyProfit, color: d.modality === 'CT' ? '#3b82f6' : d.modality === 'MRI' ? '#8b5cf6' : d.modality === 'DSA' ? '#f59e0b' : '#22c55e' }))} size={150} />
          </div>
        </div>
      )}

      {activeTab === 'drg' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            <CostCard title="DRG分组数" value={DRG_DATA.length.toString()} subtitle="涉及分组" icon={Hash} color="#3b82f6" />
            <CostCard title="平均费用" value={`¥${(DRG_DATA.reduce((s, d) => s + d.cost, 0) / DRG_DATA.length).toLocaleString()}`} subtitle="每分组平均" icon={DollarSign} color="#ef4444" />
            <CostCard title="对比全国均线" value={formatPercent(((DRG_DATA.reduce((s, d) => s + d.cost, 0) / DRG_DATA.length) / (DRG_DATA.reduce((s, d) => s + d.nationalAvgCost, 0) / DRG_DATA.length) - 1) * 100)} subtitle="本院/全国" icon={TrendingDown} color="#f59e0b" />
            <CostCard title="A类分组" value={DRG_DATA.filter(d => d.level === 'A').length.toString()} subtitle="高权重分组" icon={Award} color="#22c55e" />
          </div>

          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20 }}>
            <div style={sectionTitleStyle}><BarChart3 size={16} color="#3b82f6" /> 本院费用 vs 全国平均</div>
            <ResponsiveContainer width="100%" height={280}>
              <ChartBar data={DRG_DATA.map(d => ({ name: d.code.slice(0, 7), 本院费用: d.cost / 10000, 全国平均: d.nationalAvgCost / 10000 }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#8b949e' }} />
                <YAxis tick={{ fontSize: 12, fill: '#8b949e' }} tickFormatter={(v: number) => `${v}万`} />
                <Tooltip contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 6, fontSize: 12 }} formatter={(v: number) => [`¥${(v * 10000).toLocaleString()}`, '']} />
                <Legend />
                <Bar dataKey="本院费用" fill="#ef4444" radius={[4, 4, 0, 0]} />
                <Bar dataKey="全国平均" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </ChartBar>
            </ResponsiveContainer>
          </div>

          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #30363d', fontSize: 14, fontWeight: 600, color: '#f0f6fc' }}>DRG/DIP分组明细</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#21262d' }}>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 12, color: '#8b949e', fontWeight: 600 }}>DRG代码</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 12, color: '#8b949e', fontWeight: 600 }}>名称</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: '#8b949e', fontWeight: 600 }}>权重</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12, color: '#8b949e', fontWeight: 600 }}>本院费用</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12, color: '#8b949e', fontWeight: 600 }}>全国平均</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12, color: '#8b949e', fontWeight: 600 }}>差额</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: '#8b949e', fontWeight: 600 }}>级别</th>
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
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>固定成本/月</span><span style={{ color: '#f0f6fc' }}>¥{d.fixedCost.toLocaleString()}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>变动成本/例</span><span style={{ color: '#f0f6fc' }}>¥{d.variableCostPerExam}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>收入/例</span><span style={{ color: '#22c55e' }}>¥{d.revenuePerExam.toLocaleString()}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>盈亏平衡点</span><span style={{ color: '#f59e0b', fontWeight: 600 }}>{bep}例/月</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>实际检查量</span><span style={{ color: actualExams > bep ? '#22c55e' : '#ef4444', fontWeight: 600 }}>{actualExams}例/月</span></div>
                    <div style={{ marginTop: 8, padding: 8, borderRadius: 6, background: isProfitable ? '#22c55e20' : '#ef444420', textAlign: 'center', fontSize: 13, fontWeight: 600, color: isProfitable ? '#22c55e' : '#ef4444' }}>{isProfitable ? '✅ 盈利' : '⚠️ 亏损'}</div>
                  </div>
                </div>
              )
            })}
          </div>

          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20 }}>
            <div style={sectionTitleStyle}><BarChart3 size={16} color="#3b82f6" /> 月度收支趋势</div>
            <ResponsiveContainer width="100%" height={280}>
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
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {activeTab === 'insurance' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            <CostCard title="医保支付" value={`¥${(INSURANCE_ALLOCATION.currentMonth.filter(i => i.type === '医保').reduce((s, i) => s + i.value, 0)).toLocaleString()}`} subtitle="职工+城乡居民" icon={Landmark} color="#3b82f6" />
            <CostCard title="商保支付" value={`¥${INSURANCE_ALLOCATION.currentMonth.filter(i => i.type === '商保').reduce((s, i) => s + i.value, 0).toLocaleString()}`} subtitle="商业保险" icon={ShieldBan} color="#059669" />
            <CostCard title="自费支付" value={`¥${INSURANCE_ALLOCATION.currentMonth.filter(i => i.type === '自费').reduce((s, i) => s + i.value, 0).toLocaleString()}`} subtitle="患者自费" icon={Wallet} color="#d97706" />
            <CostCard title="医保占比" value={formatPercent((INSURANCE_ALLOCATION.currentMonth.filter(i => i.type === '医保').reduce((s, i) => s + i.value, 0) / INSURANCE_ALLOCATION.currentMonth.reduce((s, i) => s + i.value, 0)) * 100)} subtitle="支付方占比" icon={Percent} color="#22c55e" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20 }}>
              <div style={sectionTitleStyle}><PieChartIcon size={16} color="#8b949e" /> 当前月支付方构成</div>
              <SimplePieChart data={INSURANCE_ALLOCATION.currentMonth.map(i => ({ label: i.name, value: i.value / 10000, color: i.color }))} size={130} />
            </div>
            <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20 }}>
              <div style={sectionTitleStyle}><BarChart3 size={16} color="#3b82f6" /> 支付方趋势(万元)</div>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={INSURANCE_ALLOCATION.monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#8b949e' }} tickFormatter={(v: string) => v.slice(5)} />
                  <YAxis tick={{ fontSize: 12, fill: '#8b949e' }} tickFormatter={(v: number) => `${v}万`} />
                  <Tooltip contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 6 }} />
                  <Legend />
                  <Line type="monotone" dataKey="medicalInsurance" name="医保" stroke="#3b82f6" strokeWidth={2} />
                  <Line type="monotone" dataKey="commercial" name="商保" stroke="#059669" strokeWidth={2} />
                  <Line type="monotone" dataKey="selfPay" name="自费" stroke="#d97706" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'budget' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            <CostCard title="年度预算" value={`¥${BUDGET_DATA.ytd.budget.toLocaleString()}`} subtitle="YTD预算" icon={ClipboardList} color="#3b82f6" />
            <CostCard title="实际支出" value={`¥${BUDGET_DATA.ytd.actual.toLocaleString()}`} subtitle="YTD实际" icon={DollarSign} color={BUDGET_DATA.ytd.variance > 0 ? '#ef4444' : '#22c55e'} />
            <CostCard title="结余/超支" value={`¥${Math.abs(BUDGET_DATA.ytd.variance).toLocaleString()}`} subtitle={BUDGET_DATA.ytd.variance > 0 ? '超支' : '结余'} icon={TrendingUp} color={BUDGET_DATA.ytd.variance > 0 ? '#ef4444' : '#22c55e'} />
            <CostCard title="偏差率" value={formatPercent(BUDGET_DATA.ytd.varianceRate)} subtitle="差异%" icon={Percent} color={BUDGET_DATA.ytd.varianceRate > 5 ? '#ef4444' : BUDGET_DATA.ytd.varianceRate > 2 ? '#f59e0b' : '#22c55e'} />
          </div>

          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20 }}>
            <div style={sectionTitleStyle}><BarChart3 size={16} color="#3b82f6" /> 月度预算 vs 实际</div>
            <ResponsiveContainer width="100%" height={260}>
              <ChartBar data={BUDGET_DATA.monthly.map(m => ({ month: m.month.slice(5), 预算: m.budget / 10000, 实际: m.actual / 10000 }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#8b949e' }} />
                <YAxis tick={{ fontSize: 12, fill: '#8b949e' }} tickFormatter={(v: number) => `${v}万`} />
                <Tooltip contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 6 }} formatter={(v: number) => [`¥${(v * 10000).toLocaleString()}`, '']} />
                <Legend />
                <Bar dataKey="预算" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="实际" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </ChartBar>
            </ResponsiveContainer>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20 }}>
              <div style={sectionTitleStyle}><List size={16} color="#8b949e" /> 分类预算执行</div>
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
              <div style={sectionTitleStyle}><AlertTriangle size={16} color="#ef4444" /> 超预算预警</div>
              {BUDGET_DATA.monthly.filter(m => m.varianceRate > 5).length === 0 ? (
                <div style={{ color: '#22c55e', fontSize: 13 }}>所有月份预算执行良好</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {BUDGET_DATA.monthly.filter(m => m.varianceRate > 5).map(m => (
                    <div key={m.month} style={{ padding: 8, background: '#ef444420', borderRadius: 6, fontSize: 12 }}>
                      <span style={{ color: '#f0f6fc' }}>{m.month}: </span>
                      <span style={{ color: '#ef4444', fontWeight: 600 }}>超支{m.varianceRate.toFixed(1)}%</span>
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
            <CostCard title="本月收入" value={`¥${PL_DATA.currentMonth.revenue.toLocaleString()}`} subtitle="总收入" icon={TrendingUp} color="#22c55e" />
            <CostCard title="本月成本" value={`¥${PL_DATA.currentMonth.cost.toLocaleString()}`} subtitle="总成本" icon={DollarSign} color="#ef4444" />
            <CostCard title="毛利" value={`¥${PL_DATA.currentMonth.grossProfit.toLocaleString()}`} subtitle={`毛利率 ${((PL_DATA.currentMonth.grossProfit / PL_DATA.currentMonth.revenue) * 100).toFixed(1)}%`} icon={Wallet} color="#f59e0b" />
            <CostCard title="净利润" value={`¥${PL_DATA.currentMonth.netIncome.toLocaleString()}`} subtitle={`净利率 ${PL_DATA.currentMonth.profitRate}%`} icon={Award} color="#22c55e" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20 }}>
              <div style={sectionTitleStyle}><List size={16} color="#8b949e" /> 本月损益明细</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {PL_DATA.breakdown.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: idx < PL_DATA.breakdown.length - 1 ? '1px solid #21262d' : 'none', fontSize: 12 }}>
                    <span style={{ color: '#f0f6fc' }}>{item.item}</span>
                    <span style={{ color: item.amount >= 0 ? '#22c55e' : '#ef4444', fontWeight: 600 }}>{item.amount >= 0 ? '+' : ''}¥{item.amount.toLocaleString()}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', fontSize: 14, fontWeight: 700, borderTop: '2px solid #30363d', marginTop: 4 }}>
                  <span style={{ color: '#f0f6fc' }}>净利润</span>
                  <span style={{ color: PL_DATA.currentMonth.netIncome >= 0 ? '#22c55e' : '#ef4444' }}>¥{PL_DATA.currentMonth.netIncome.toLocaleString()}</span>
                </div>
              </div>
            </div>
            <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20 }}>
              <div style={sectionTitleStyle}><BarChart3 size={16} color="#3b82f6" /> 月度损益趋势</div>
              <ResponsiveContainer width="100%" height={280}>
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
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'claims' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            <CostCard title="理赔总数" value={CLAIMS_DATA.claims.length.toString()} subtitle="本月" icon={FileText} color="#3b82f6" />
            <CostCard title="已通过" value={CLAIMS_DATA.claims.filter(c => c.status === '已通过').length.toString()} subtitle="理赔成功" icon={CheckCircle} color="#22c55e" />
            <CostCard title="已拒绝" value={CLAIMS_DATA.claims.filter(c => c.status === '已拒绝').length.toString()} subtitle="需处理" icon={XCircle} color="#ef4444" />
            <CostCard title="申诉中" value={CLAIMS_DATA.claims.filter(c => c.status === '申诉中').length.toString()} subtitle="待跟进" icon={MessageSquare} color="#f59e0b" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #30363d', fontSize: 14, fontWeight: 600, color: '#f0f6fc' }}>理赔清单</div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#21262d' }}>
                    <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 12, color: '#8b949e' }}>单号</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 12, color: '#8b949e' }}>患者</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 12, color: '#8b949e' }}>类型</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right', fontSize: 12, color: '#8b949e' }}>金额</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center', fontSize: 12, color: '#8b949e' }}>状态</th>
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
                <button style={{ padding: '6px 14px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 4, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}><Send size={14} /> 生成837理赔</button>
                <button style={{ padding: '6px 14px', background: '#21262d', color: '#8b949e', border: '1px solid #30363d', borderRadius: 4, fontSize: 12, cursor: 'pointer' }}><RefreshCw size={14} style={{ marginRight: 4 }} />刷新</button>
              </div>
            </div>
            <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20 }}>
              <div style={sectionTitleStyle}><Ban size={16} color="#ef4444" /> 拒赔原因分析</div>
              <SimpleHorizontalBarChart data={CLAIMS_DATA.denialReasons.map(r => ({ label: r.reason, value: r.count, color: '#ef4444' }))} height={180} />
              <div style={{ marginTop: 16, padding: 12, background: '#21262d', borderRadius: 6 }}>
                <div style={{ fontSize: 12, color: '#8b949e', marginBottom: 8 }}>申诉流程</div>
                <div style={{ display: 'flex', gap: 8, fontSize: 12, color: '#f0f6fc' }}>
                  <span style={{ padding: '4px 8px', background: '#3b82f620', borderRadius: 4, color: '#3b82f6' }}>1. 补充材料</span>
                  <ArrowRight size={14} style={{ color: '#8b949e', alignSelf: 'center' }} />
                  <span style={{ padding: '4px 8px', background: '#f59e0b20', borderRadius: 4, color: '#f59e0b' }}>2. 提交申诉</span>
                  <ArrowRight size={14} style={{ color: '#8b949e', alignSelf: 'center' }} />
                  <span style={{ padding: '4px 8px', background: '#22c55e20', borderRadius: 4, color: '#22c55e' }}>3. 重新核定</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
