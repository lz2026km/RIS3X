
import { Filter } from 'lucide-react'
import { GRAY, WHITE } from './reportUtils'

export interface ReportAdvancedFilterProps {
  showAdvancedFilter: boolean
  setShowAdvancedFilter: (v: boolean) => void
  qualityScoreFrom: number
  setQualityScoreFrom: (v: number) => void
  qualityScoreTo: number
  setQualityScoreTo: (v: number) => void
}

export default function ReportAdvancedFilter({
  showAdvancedFilter, setShowAdvancedFilter,
  qualityScoreFrom, setQualityScoreFrom,
  qualityScoreTo, setQualityScoreTo,
}: ReportAdvancedFilterProps) {
  return (
    <div style={{ marginBottom: showAdvancedFilter ? 14 : 0, transition: 'all 0.2s' }}>
      <button onClick={() => setShowAdvancedFilter(!showAdvancedFilter)}
        style={{
          padding: '6px 14px', borderRadius: 8, border: `1px solid ${showAdvancedFilter ? '#1e40af' : '#e2e8f0'}`,
          background: showAdvancedFilter ? '#eff6ff' : WHITE, color: showAdvancedFilter ? '#1e40af' : GRAY,
          fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, marginBottom: showAdvancedFilter ? 10 : 0,
        }}>
        <Filter size={13} /> 高级筛选 {showAdvancedFilter ? '▲' : '▼'}
      </button>
      {showAdvancedFilter && (
        <div style={{ background: WHITE, borderRadius: 10, padding: '14px 16px', border: '1px solid #e2e8f0', display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: GRAY, fontWeight: 600 }}>质量评分:</span>
            <input type="number" value={qualityScoreFrom} onChange={e => setQualityScoreFrom(Number(e.target.value) || 0)}
              min={0} max={100} style={{ width: 50, padding: '4px 6px', border: '1px solid #e2e8f0', borderRadius: 4, fontSize: 12, outline: 'none', color: '#334155' }} />
            <span style={{ fontSize: 12, color: GRAY }}>—</span>
            <input type="number" value={qualityScoreTo} onChange={e => setQualityScoreTo(Number(e.target.value) || 100)}
              min={0} max={100} style={{ width: 50, padding: '4px 6px', border: '1px solid #e2e8f0', borderRadius: 4, fontSize: 12, outline: 'none', color: '#334155' }} />
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>当前筛选: 质量评分 {qualityScoreFrom} ~ {qualityScoreTo}</div>
        </div>
      )}
    </div>
  )
}
