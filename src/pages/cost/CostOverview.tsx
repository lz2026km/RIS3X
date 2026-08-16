import { useMemo } from 'react'
import { DollarSign, Calendar, TrendingUp, Users, PieChart as PieChartIcon, Activity, Monitor } from 'lucide-react'
import { EQUIPMENT_DATA, CONSUMABLE_DATA, LABOR_DATA, BENEFIT_DATA, formatCurrency, calculateUnitCost } from './index'
import { CostCard, SimplePieChart, SimpleBarChart } from './CostChart'
import { EquipmentRow } from './CostTable'
import { t } from '../../i18n/appI18n'

// [W3-B] financeApi 实时成本/收益数据 (由 CostAnalysisPage 注入)
export interface LiveOverviewData {
  revenue: number
  cost: number
  profit: number
  marginPct: number
  totalExams: number
  monthly: { month: string; revenue: number; cost: number }[]
  source: string
}

export function CostOverview({ live }: { live?: LiveOverviewData | null }) {
  const summaryData = useMemo(() => {
    if (live) {
      const monthlyAvgCost = live.monthly.length > 0 ? live.cost / live.monthly.length : live.cost / 12
      return {
        totalEquipmentCost: 0,
        totalConsumableCost: 0,
        totalLaborCost: 0,
        totalCost: live.cost,
        latestRevenue: live.revenue,
        totalExams: live.totalExams,
        monthlyAvgCost,
        costPerExam: live.totalExams > 0 ? live.cost / live.totalExams : 0,
      }
    }
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
  }, [live])

  const equipmentWithUnitCost = useMemo(() => {
    return EQUIPMENT_DATA.map(eq => ({ ...eq, unitCost: calculateUnitCost(eq), totalAnnual: (eq.purchasePrice / eq.depreciationYears) + eq.annualMaintenance }))
  }, [])

  const costCompositionData = live
    ? []
    : [
        { label: t('w8.costOverview.equipmentCost'), value: summaryData.totalEquipmentCost, color: '#3b82f6' },
        { label: t('w8.costOverview.consumableCost'), value: summaryData.totalConsumableCost, color: '#22c55e' },
        { label: t('w8.costOverview.laborCost'), value: summaryData.totalLaborCost, color: '#f59e0b' },
      ]

  const costTrendData = live
    ? live.monthly.map(m => ({ label: m.month.length >= 7 ? m.month.slice(5) : m.month, value: m.cost, color: '#3b82f6' }))
    : BENEFIT_DATA.map(b => ({ label: b.month.slice(5), value: b.cost, color: '#3b82f6' }))
  const benefitTrendData = live
    ? live.monthly.map(m => ({ label: m.month.length >= 7 ? m.month.slice(5) : m.month, value: m.revenue - m.cost, color: '#22c55e' }))
    : BENEFIT_DATA.map(b => ({ label: b.month.slice(5), value: b.profit, color: '#22c55e' }))

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
        <CostCard title={t('w8.costOverview.totalCost')} value={formatCurrency(summaryData.totalCost)} subtitle={live ? t('w8.costOverview.liveTag') : t('w8.costOverview.costComposition')} icon={DollarSign} trend={live ? undefined : 'up'} trendValue={live ? undefined : '+5.2%'} color="#ef4444" />
        <CostCard title={t('w8.costOverview.monthlyAvgCost')} value={formatCurrency(summaryData.monthlyAvgCost)} subtitle={t('w8.costOverview.monthlySubtitle')} icon={Calendar} color="#f59e0b" />
        <CostCard title={t('w8.costOverview.totalRevenue')} value={formatCurrency(summaryData.latestRevenue)} subtitle={live ? t('w8.costOverview.liveTag') : t('w8.costOverview.revenueSubtitle')} icon={TrendingUp} trend={live ? undefined : 'up'} trendValue={live ? undefined : '+12.5%'} color="#22c55e" />
        <CostCard title={t('w8.costOverview.costPerExam')} value={formatCurrency(summaryData.costPerExam, true)} subtitle={t('w8.costOverview.examsSubtitle', { count: summaryData.totalExams.toLocaleString() })} icon={Users} color="#3b82f6" />
      </div>

      <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20 }}>
        <div style={sectionTitleStyle}>
          <PieChartIcon size={16} color="#8b949e" />
          {t('w8.costOverview.costCompositionTitle')} {live && <span style={{ fontSize: 11, color: '#f59e0b' }}>{t('w8.costOverview.demoNote')}</span>}
        </div>
        {live ? (
          <div style={{ fontSize: 13, color: '#8b949e', padding: 12, background: '#21262d', borderRadius: 6 }}>
            {t('w8.costOverview.liveNote')}
          </div>
        ) : (
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
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20 }}>
          <div style={sectionTitleStyle}><Activity size={16} color="#3b82f6" />{t('w8.costOverview.costTrendTitle')} {live && <span style={{ fontSize: 11, color: '#22c55e' }}>({t('w8.costOverview.realtime')})</span>}</div>
          <SimpleBarChart data={costTrendData} height={180} />
        </div>
        <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20 }}>
          <div style={sectionTitleStyle}><TrendingUp size={16} color="#22c55e" />{t('w8.costOverview.profitTrendTitle')} {live && <span style={{ fontSize: 11, color: '#22c55e' }}>({t('w8.costOverview.realtime')})</span>}</div>
          <SimpleBarChart data={benefitTrendData} height={180} />
        </div>
      </div>

      <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20 }}>
        <div style={sectionTitleStyle}><Monitor size={16} color="#3b82f6" />{t('w8.costOverview.equipmentRankingTitle')} {live && <span style={{ fontSize: 11, color: '#f59e0b' }}>{t('w8.costOverview.demoData')}</span>}</div>
        <div style={{
          display: 'grid', gridTemplateColumns: '40px 1fr 80px 100px 100px 100px 100px', gap: 8,
          padding: '8px 16px', background: '#21262d', borderBottom: '1px solid #30363d',
          fontSize: 12, fontWeight: 600, color: '#8b949e',
        }}>
          <span>{t('w8.costOverview.colRank')}</span><span>{t('w8.costOverview.colDeviceName')}</span><span>{t('w8.costOverview.colType')}</span><span>{t('w8.costOverview.colPurchase')}</span><span>{t('w8.costOverview.colAnnualCost')}</span><span>{t('w8.costOverview.colUsage')}</span><span>{t('w8.costOverview.colUnitCost')}</span>
        </div>
        {equipmentWithUnitCost.sort((a, b) => a.unitCost - b.unitCost).slice(0, 4).map((eq, idx) => (
          <EquipmentRow key={eq.id} equipment={eq} index={idx} />
        ))}
      </div>
    </div>
  )
}
