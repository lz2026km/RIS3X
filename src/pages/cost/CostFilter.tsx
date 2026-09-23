import React from 'react'
import {
  BarChart3, Server, Film, Users, TrendingUp, Package, Clock, Percent, Award,
  Hash, BadgePercent, Landmark, ClipboardList, FileSpreadsheet, Gavel, type LucideIcon,
} from 'lucide-react'
import type { TimeRange, TabType } from './index'
import { PRIMARY } from './index'
import { t } from '../../i18n/appI18n'

const TABS_CONFIG: { key: TabType; label: string; icon: LucideIcon }[] = [
  { key: 'overview', label: t('costFilter.tabOverview'), icon: BarChart3 },
  { key: 'equipment', label: t('costFilter.tabEquipment'), icon: Server },
  { key: 'consumable', label: t('costFilter.tabConsumable'), icon: Film },
  { key: 'labor', label: t('costFilter.tabLabor'), icon: Users },
  { key: 'benefit', label: t('costFilter.tabBenefit'), icon: TrendingUp },
  { key: 'medicalConsumable', label: t('costFilter.tabMedicalConsumable'), icon: Package },
  { key: 'depreciation', label: t('costFilter.tabDepreciation'), icon: Clock },
  { key: 'profitMargin', label: t('costFilter.tabProfitMargin'), icon: Percent },
  { key: 'departmentRanking', label: t('costFilter.tabDepartmentRanking'), icon: Award },
  { key: 'drg', label: t('costFilter.tabDrg'), icon: Hash },
  { key: 'breakeven', label: t('costFilter.tabBreakeven'), icon: BadgePercent },
  { key: 'insurance', label: t('costFilter.tabInsurance'), icon: Landmark },
  { key: 'budget', label: t('costFilter.tabBudget'), icon: ClipboardList },
  { key: 'pl', label: t('costFilter.tabPl'), icon: FileSpreadsheet },
  { key: 'claims', label: t('costFilter.tabClaims'), icon: Gavel },
]

export function CostFilter({ activeTab, onTabChange, timeRange, onTimeRangeChange }: {
  activeTab: TabType
  onTabChange: (tab: TabType) => void
  timeRange: TimeRange
  onTimeRangeChange: (range: TimeRange) => void
}) {
  const tabsStyle: React.CSSProperties = {
    display: 'flex',
    gap: 4,
    marginBottom: 20,
    borderBottom: '1px solid #30363d',
    paddingBottom: 0,
    flexWrap: 'wrap',
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#f0f6fc', marginBottom: 4 }}>{t('costFilter.title')}</div>
          <div style={{ fontSize: 13, color: '#6e7681' }}>{t('costFilter.subtitle')}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['month', 'quarter', 'year'] as TimeRange[]).map(range => (
            <button
              key={range}
              onClick={() => onTimeRangeChange(range)}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: 'none',
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
                background: timeRange === range ? PRIMARY : '#21262d',
                color: timeRange === range ? '#fff' : '#8b949e',
                transition: 'all 0.2s',
              }}
            >
              {range === 'month' ? t('costFilter.monthly') : range === 'quarter' ? t('costFilter.quarterly') : t('costFilter.yearly')}
            </button>
          ))}
        </div>
      </div>

      <div style={tabsStyle}>
        {TABS_CONFIG.map(tab => (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            style={{
              padding: '10px 16px',
              border: 'none',
              borderBottom: activeTab === tab.key ? '2px solid #3b82f6' : '2px solid transparent',
              background: 'transparent',
              color: activeTab === tab.key ? '#f0f6fc' : '#8b949e',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              transition: 'all 0.2s',
            }}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>
    </>
  )
}
