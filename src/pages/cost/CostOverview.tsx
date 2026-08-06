import { useMemo } from 'react'
import { DollarSign, Calendar, TrendingUp, Users, PieChart as PieChartIcon, Activity, Monitor } from 'lucide-react'
import { EQUIPMENT_DATA, CONSUMABLE_DATA, LABOR_DATA, BENEFIT_DATA, formatCurrency, calculateUnitCost } from './index'
import { CostCard, SimplePieChart, SimpleBarChart } from './CostChart'
import { EquipmentRow } from './CostTable'

export function CostOverview() {
  const summaryData = useMemo(() => {
    const totalEquipmentCost = EQUIPMENT_DATA.reduce((sum, eq) => {
      const annualDep = eq.purchasePrice / eq.depreciationYears
      return sum + annualDep + eq.annualMaintenance
    }, 0)
    const totalConsumableCost = CONSUMABLE_DATA.reduce((sum, c) => sum + c.annualCost, 0)
    const totalLaborCost = LABOR_DATA.reduce((sum, l) => sum + l.count * l.avgSalary * 12, 0)
    const totalCost = totalEquipmentCost + totalConsumableCost + totalLaborCost
    const latestRevenue = BENEFIT_DATA[BENEFIT_DATA.length - 1]?.revenue || 0
    const totalExams = BENEFIT_DATA.reduce((sum, b) => sum + b.examCount, 0)
    const monthlyAvgCost = totalCost / 12
    const costPerExam = totalCost / totalExams
    return { totalEquipmentCost, totalConsumableCost, totalLaborCost, totalCost, latestRevenue, totalExams, monthlyAvgCost, costPerExam }
  }, [])

  const equipmentWithUnitCost = useMemo(() => {
    return EQUIPMENT_DATA.map(eq => ({ ...eq, unitCost: calculateUnitCost(eq), totalAnnual: (eq.purchasePrice / eq.depreciationYears) + eq.annualMaintenance }))
  }, [])

  const costCompositionData = [
    { label: '设备折旧+维护', value: summaryData.totalEquipmentCost, color: '#3b82f6' },
    { label: '耗材成本', value: summaryData.totalConsumableCost, color: '#22c55e' },
    { label: '人力成本', value: summaryData.totalLaborCost, color: '#f59e0b' },
  ]

  const costTrendData = BENEFIT_DATA.map(b => ({ label: b.month.slice(5), value: b.cost, color: '#3b82f6' }))
  const benefitTrendData = BENEFIT_DATA.map(b => ({ label: b.month.slice(5), value: b.profit, color: '#22c55e' }))

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: 14,
    fontWeight: 600,
    color: '#f0f6fc',
    marginBottom: 12,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        <CostCard title="年度总成本" value={formatCurrency(summaryData.totalCost)} subtitle="设备+耗材+人力" icon={DollarSign} trend="up" trendValue="+5.2%" color="#ef4444" />
        <CostCard title="月均成本" value={formatCurrency(summaryData.monthlyAvgCost)} subtitle="月度平均支出" icon={Calendar} color="#f59e0b" />
        <CostCard title="年度总收入" value={formatCurrency(summaryData.latestRevenue)} subtitle="最新月份收入" icon={TrendingUp} trend="up" trendValue="+12.5%" color="#22c55e" />
        <CostCard title="人次均成本" value={formatCurrency(summaryData.costPerExam, true)} subtitle={`共 ${summaryData.totalExams.toLocaleString()} 人次`} icon={Users} color="#3b82f6" />
      </div>

      <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20 }}>
        <div style={sectionTitleStyle}>
          <PieChartIcon size={16} color="#8b949e" />
          成本构成分析
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 40 }}>
          <SimplePieChart data={costCompositionData} size={140} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {costCompositionData.map((item, idx) => (
              <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: '#f0f6fc' }}>{item.label}</span>
                  <span style={{ fontSize: 13, color: item.color, fontWeight: 600 }}>{formatCurrency(item.value)}</span>
                </div>
                <div style={{ height: 6, background: '#21262d', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${(item.value / summaryData.totalCost) * 100}%`, height: '100%', background: item.color, borderRadius: 3, transition: 'width 0.3s ease' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20 }}>
          <div style={sectionTitleStyle}><Activity size={16} color="#3b82f6" />月度成本趋势</div>
          <SimpleBarChart data={costTrendData} height={180} />
        </div>
        <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20 }}>
          <div style={sectionTitleStyle}><TrendingUp size={16} color="#22c55e" />月度利润趋势</div>
          <SimpleBarChart data={benefitTrendData} height={180} />
        </div>
      </div>

      <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20 }}>
        <div style={sectionTitleStyle}><Monitor size={16} color="#3b82f6" />设备成本效率排名</div>
        <div style={{
          display: 'grid', gridTemplateColumns: '40px 1fr 80px 100px 100px 100px 100px', gap: 8,
          padding: '8px 16px', background: '#21262d', borderBottom: '1px solid #30363d',
          fontSize: 12, fontWeight: 600, color: '#8b949e',
        }}>
          <span>#</span><span>设备名称</span><span>类型</span><span>采购价(万)</span><span>年成本(万)</span><span>年检查量</span><span>单次成本</span>
        </div>
        {equipmentWithUnitCost.sort((a, b) => a.unitCost - b.unitCost).slice(0, 4).map((eq, idx) => (
          <EquipmentRow key={eq.id} equipment={eq} index={idx} />
        ))}
      </div>
    </div>
  )
}
