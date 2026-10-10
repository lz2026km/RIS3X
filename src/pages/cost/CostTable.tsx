import { Trophy } from 'lucide-react'
import { formatCurrency } from './index'
import type { EquipmentCost, ConsumableCost, LaborCost, MedicalConsumableDetail, EquipmentDepreciation, ExamProfitMargin, DeptRevenue } from './index'

export function EquipmentRow({ equipment, index }: { equipment: EquipmentCost; index: number }) {
  const unitCostNum = (equipment.purchasePrice / equipment.depreciationYears + equipment.annualMaintenance) / equipment.annualUsage
  const totalAnnual = (equipment.purchasePrice / equipment.depreciationYears) + equipment.annualMaintenance

  const rowStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '40px 1fr 80px 100px 100px 100px 100px',
    gap: 8,
    padding: '12px 16px',
    borderBottom: '1px solid var(--bg-secondary, #21262d)',
    alignItems: 'center',
    background: index % 2 === 0 ? 'var(--bg-primary, #0d1117)' : 'var(--bg-card, #161b22)',
  }

  const modalityColors: Record<string, string> = {
    'CT': '#3b82f6',
    'MRI': '#8b5cf6',
    'DSA': '#f59e0b',
  }

  return (
    <div style={rowStyle}>
      <span style={{ color: '#6e7681', fontSize: 12 }}>{index + 1}</span>
      <div>
        <div style={{ color: 'var(--text-primary, #f0f6fc)', fontSize: 13, fontWeight: 500 }}>{equipment.name}</div>
        <div style={{ color: '#6e7681', fontSize: 12 }}>{equipment.id.toUpperCase()}</div>
      </div>
      <span style={{
        padding: '2px 8px',
        borderRadius: 4,
        fontSize: 12,
        fontWeight: 500,
        background: `${modalityColors[equipment.modality]}20`,
        color: modalityColors[equipment.modality],
      }}>
        {equipment.modality}
      </span>
      <span style={{ color: 'var(--text-muted, #8b949e)', fontSize: 13 }}>{formatCurrency(equipment.purchasePrice)}</span>
      <span style={{ color: 'var(--text-muted, #8b949e)', fontSize: 13 }}>{formatCurrency(totalAnnual)}</span>
      <span style={{ color: 'var(--text-muted, #8b949e)', fontSize: 13 }}>{equipment.annualUsage.toLocaleString()}</span>
      <span style={{ color: '#22c55e', fontSize: 13, fontWeight: 600 }}>
        ¥{unitCostNum.toFixed(0)}
      </span>
    </div>
  )
}

export function ConsumableRow({ item, index }: { item: ConsumableCost; index: number }) {
  const categoryColors: Record<string, string> = {
    '胶片': '#22c55e',
    '对比剂': '#3b82f6',
    '注射器': '#f59e0b',
    '耗材': '#ef4444',
    '其他': '#8b949e',
  }

  const rowStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '40px 1fr 80px 80px 100px 100px',
    gap: 8,
    padding: '12px 16px',
    borderBottom: '1px solid var(--bg-secondary, #21262d)',
    alignItems: 'center',
    background: index % 2 === 0 ? 'var(--bg-primary, #0d1117)' : 'var(--bg-card, #161b22)',
  }

  return (
    <div style={rowStyle}>
      <span style={{ color: '#6e7681', fontSize: 12 }}>{index + 1}</span>
      <span style={{ color: 'var(--text-primary, #f0f6fc)', fontSize: 13 }}>{item.name}</span>
      <span style={{
        padding: '2px 8px',
        borderRadius: 4,
        fontSize: 12,
        fontWeight: 500,
        background: `${categoryColors[item.category]}20`,
        color: categoryColors[item.category],
      }}>
        {item.category}
      </span>
      <span style={{ color: 'var(--text-muted, #8b949e)', fontSize: 13 }}>{formatCurrency(item.unitPrice, true)}/{item.unit}</span>
      <span style={{ color: 'var(--text-muted, #8b949e)', fontSize: 13 }}>{item.monthlyUsage.toLocaleString()}</span>
      <span style={{ color: '#22c55e', fontSize: 13, fontWeight: 600 }}>
        {formatCurrency(item.annualCost, true)}
      </span>
    </div>
  )
}

export function LaborRow({ item, index }: { item: LaborCost; index: number }) {
  const annualCost = item.count * item.avgSalary * 12
  const roleColors: Record<string, string> = {
    '技师': '#3b82f6',
    '护士': '#22c55e',
    '医师': '#f59e0b',
    '登记员': '#8b949e',
  }
  const roleType = item.role.includes('技师') ? '技师' : item.role.includes('护士') ? '护士' : item.role.includes('医师') ? '医师' : '登记员'

  const rowStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '40px 1fr 60px 100px 100px 100px',
    gap: 8,
    padding: '12px 16px',
    borderBottom: '1px solid var(--bg-secondary, #21262d)',
    alignItems: 'center',
    background: index % 2 === 0 ? 'var(--bg-primary, #0d1117)' : 'var(--bg-card, #161b22)',
  }

  return (
    <div style={rowStyle}>
      <span style={{ color: '#6e7681', fontSize: 12 }}>{index + 1}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          padding: '2px 8px',
          borderRadius: 4,
          fontSize: 12,
          fontWeight: 500,
          background: `${roleColors[roleType]}20`,
          color: roleColors[roleType],
        }}>
          {roleType}
        </span>
        <span style={{ color: 'var(--text-primary, #f0f6fc)', fontSize: 13 }}>{item.role}</span>
      </div>
      <span style={{ color: 'var(--text-muted, #8b949e)', fontSize: 13 }}>{item.count}人</span>
      <span style={{ color: 'var(--text-muted, #8b949e)', fontSize: 13 }}>{formatCurrency(item.avgSalary, true)}/月</span>
      <span style={{ color: 'var(--text-muted, #8b949e)', fontSize: 13 }}>{formatCurrency(annualCost, true)}</span>
      <span style={{ color: '#22c55e', fontSize: 13, fontWeight: 600 }}>
        {item.count > 0 ? Math.round(item.workload / item.count) : 0}例/人
      </span>
    </div>
  )
}

export function MedicalConsumableRow({ item, index }: { item: MedicalConsumableDetail; index: number }) {
  const examTypeColors: Record<string, string> = {
    'CT增强': '#3b82f6',
    'MR增强': '#8b5cf6',
    'DSA': '#f59e0b',
  }

  const rowStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '40px 80px 1fr 80px 80px 100px 120px',
    gap: 8,
    padding: '12px 16px',
    borderBottom: '1px solid var(--bg-secondary, #21262d)',
    alignItems: 'center',
    background: index % 2 === 0 ? 'var(--bg-primary, #0d1117)' : 'var(--bg-card, #161b22)',
  }

  return (
    <div style={rowStyle}>
      <span style={{ color: '#6e7681', fontSize: 12 }}>{index + 1}</span>
      <span style={{
        padding: '2px 8px',
        borderRadius: 4,
        fontSize: 12,
        fontWeight: 500,
        background: `${examTypeColors[item.examType] || '#8b949e'}20`,
        color: examTypeColors[item.examType] || '#8b949e',
      }}>
        {item.examType}
      </span>
      <span style={{ color: 'var(--text-primary, #f0f6fc)', fontSize: 13 }}>{item.itemName}</span>
      <span style={{ color: 'var(--text-muted, #8b949e)', fontSize: 13 }}>{item.unit}</span>
      <span style={{ color: 'var(--text-muted, #8b949e)', fontSize: 13 }}>¥{item.unitPrice.toLocaleString()}</span>
      <span style={{ color: 'var(--text-muted, #8b949e)', fontSize: 13 }}>{item.monthlyUsage.toLocaleString()}</span>
      <span style={{ color: '#22c55e', fontSize: 13, fontWeight: 600 }}>
        ¥{item.annualCost.toLocaleString()}
      </span>
    </div>
  )
}

export function DepreciationRow({ item, index }: { item: EquipmentDepreciation; index: number }) {
  const modalityColors: Record<string, string> = {
    'CT': '#3b82f6',
    'MRI': '#8b5cf6',
    'DSA': '#f59e0b',
  }

  const rowStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '40px 1fr 80px 80px 80px 80px 100px 100px 100px',
    gap: 8,
    padding: '12px 16px',
    borderBottom: '1px solid var(--bg-secondary, #21262d)',
    alignItems: 'center',
    background: index % 2 === 0 ? 'var(--bg-primary, #0d1117)' : 'var(--bg-card, #161b22)',
  }

  const methodLabel = item.depreciationMethod === 'straightLine' ? '直线法' : '双倍余额递减'

  return (
    <div style={rowStyle}>
      <span style={{ color: '#6e7681', fontSize: 12 }}>{index + 1}</span>
      <div>
        <div style={{ color: 'var(--text-primary, #f0f6fc)', fontSize: 13, fontWeight: 500 }}>{item.name}</div>
        <div style={{ color: '#6e7681', fontSize: 12 }}>{item.id}</div>
      </div>
      <span style={{
        padding: '2px 8px',
        borderRadius: 4,
        fontSize: 12,
        fontWeight: 500,
        background: `${modalityColors[item.modality]}20`,
        color: modalityColors[item.modality],
      }}>
        {item.modality}
      </span>
      <span style={{ color: 'var(--text-muted, #8b949e)', fontSize: 12 }}>{methodLabel}</span>
      <span style={{ color: 'var(--text-muted, #8b949e)', fontSize: 13 }}>{item.usefulYears}年</span>
      <span style={{ color: 'var(--text-muted, #8b949e)', fontSize: 13 }}>{formatCurrency(item.purchasePrice)}</span>
      <span style={{ color: '#ef4444', fontSize: 13 }}>¥{item.monthlyDepreciation.toFixed(1)}万</span>
      <span style={{ color: '#f59e0b', fontSize: 13 }}>¥{item.annualDepreciation.toFixed(1)}万</span>
      <span style={{ color: '#22c55e', fontSize: 13, fontWeight: 600 }}>
        ¥{item.currentBookValue.toFixed(1)}万
      </span>
    </div>
  )
}

export function ProfitMarginRow({ item, index }: { item: ExamProfitMargin; index: number }) {
  const modalityColors: Record<string, string> = {
    'CT': '#3b82f6',
    'MRI': '#8b5cf6',
    'DSA': '#f59e0b',
    '普放': '#22c55e',
  }

  const rowStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '40px 1fr 80px 90px 90px 90px 100px 100px',
    gap: 8,
    padding: '12px 16px',
    borderBottom: '1px solid var(--bg-secondary, #21262d)',
    alignItems: 'center',
    background: index % 2 === 0 ? 'var(--bg-primary, #0d1117)' : 'var(--bg-card, #161b22)',
  }

  const profitRateColor = item.isLoss ? '#ef4444' : item.profitRate < 20 ? '#f59e0b' : '#22c55e'

  return (
    <div style={rowStyle}>
      <span style={{ color: '#6e7681', fontSize: 12 }}>{index + 1}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          padding: '2px 8px',
          borderRadius: 4,
          fontSize: 12,
          fontWeight: 500,
          background: `${modalityColors[item.modality]}20`,
          color: modalityColors[item.modality],
        }}>
          {item.modality}
        </span>
        <span style={{ color: 'var(--text-primary, #f0f6fc)', fontSize: 13 }}>{item.examName}</span>
        {item.isLoss && (
          <span style={{
            padding: '2px 6px',
            borderRadius: 4,
            fontSize: 12,
            fontWeight: 600,
            background: '#ef444420',
            color: '#ef4444',
          }}>
            亏损
          </span>
        )}
      </div>
      <span style={{ color: 'var(--text-muted, #8b949e)', fontSize: 13 }}>{item.monthlyCount}例</span>
      <span style={{ color: '#22c55e', fontSize: 13 }}>¥{item.revenue}</span>
      <span style={{ color: '#ef4444', fontSize: 13 }}>¥{item.cost}</span>
      <span style={{ color: profitRateColor, fontSize: 13, fontWeight: 600 }}>
        {item.isLoss ? '-' : ''}{Math.abs(item.profitRate).toFixed(1)}%
      </span>
      <span style={{ color: item.isLoss ? '#ef4444' : '#22c55e', fontSize: 13 }}>
        {item.isLoss ? '-' : '+'}¥{Math.abs(item.monthlyProfit).toLocaleString()}
      </span>
      <span style={{
        padding: '2px 8px',
        borderRadius: 4,
        fontSize: 12,
        fontWeight: 500,
        background: item.isLoss ? '#ef444420' : '#22c55e20',
        color: item.isLoss ? '#ef4444' : '#22c55e',
      }}>
        {item.isLoss ? '亏损' : '盈利'}
      </span>
    </div>
  )
}

export function DeptRevenueRow({ item, index }: { item: DeptRevenue; index: number }) {
  const modalityColors: Record<string, string> = {
    'CT': '#3b82f6',
    'MRI': '#8b5cf6',
    'DSA': '#f59e0b',
    '普放': '#22c55e',
  }

  const rowStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '40px 1fr 80px 90px 90px 90px 80px 90px 90px',
    gap: 8,
    padding: '12px 16px',
    borderBottom: '1px solid var(--bg-secondary, #21262d)',
    alignItems: 'center',
    background: index % 2 === 0 ? 'var(--bg-primary, #0d1117)' : 'var(--bg-card, #161b22)',
  }

  return (
    <div style={rowStyle}>
      <span style={{ color: '#6e7681', fontSize: 12 }}>
        {index < 3 ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: '#f59e0b', fontWeight: 700 }}>
            <Trophy size={12} />{index + 1}
          </span>
        ) : index + 1}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          padding: '2px 8px',
          borderRadius: 4,
          fontSize: 12,
          fontWeight: 500,
          background: `${modalityColors[item.modality]}20`,
          color: modalityColors[item.modality],
        }}>
          {item.modality}
        </span>
        <span style={{ color: 'var(--text-primary, #f0f6fc)', fontSize: 13, fontWeight: 500 }}>{item.deptName}</span>
      </div>
      <span style={{ color: 'var(--text-muted, #8b949e)', fontSize: 13 }}>{item.examCount}例</span>
      <span style={{ color: '#22c55e', fontSize: 13 }}>{formatCurrency(item.monthlyRevenue)}</span>
      <span style={{ color: '#ef4444', fontSize: 13 }}>{formatCurrency(item.monthlyCost)}</span>
      <span style={{ color: '#22c55e', fontSize: 13, fontWeight: 600 }}>{formatCurrency(item.monthlyProfit)}</span>
      <span style={{ color: 'var(--text-muted, #8b949e)', fontSize: 12 }}>¥{item.profitPerExam}/人</span>
      <span style={{ color: item.yoyGrowth >= 0 ? '#22c55e' : '#ef4444', fontSize: 12 }}>
        {item.yoyGrowth >= 0 ? '+' : ''}{item.yoyGrowth.toFixed(1)}%
      </span>
      <span style={{ color: item.momGrowth >= 0 ? '#22c55e' : '#ef4444', fontSize: 12 }}>
        {item.momGrowth >= 0 ? '+' : ''}{item.momGrowth.toFixed(1)}%
      </span>
    </div>
  )
}
