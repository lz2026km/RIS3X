import React from 'react'
import { Search, X } from 'lucide-react'
import { styles, COLORS } from './RegionalReportServiceWire'
import { t } from '../../i18n/appI18n'

interface RegionalReportFilterProps {
  searchKeyword: string
  onSearchChange: (value: string) => void
  placeholder?: string
}

const RegionalReportFilter: React.FC<RegionalReportFilterProps> = ({ searchKeyword, onSearchChange, placeholder = t('w9e.regionalReportFilter.searchPlaceholder') }) => {
  return (
    <div style={styles.searchBox}>
      <Search size={16} style={{ color: COLORS.textMuted }} />
      <input
        type="text"
        placeholder={placeholder}
        style={{ ...styles.input, flex: 1, border: 'none', backgroundColor: 'transparent' }}
        value={searchKeyword}
        onChange={(e) => onSearchChange(e.target.value)}
      />
      {searchKeyword && (
        <X
          size={14}
          style={{ cursor: 'pointer', color: COLORS.textMuted }}
          onClick={() => onSearchChange('')}
        />
      )}
    </div>
  )
}

export default RegionalReportFilter
