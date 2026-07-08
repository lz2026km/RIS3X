// @ts-nocheck
import { Filter } from "lucide-react";
import { t } from '../../i18n/appI18n';
import { COLORS, styles } from './DataReportCharts';

export default function DataReportFilters({
  dateRange, setDateRange, modality, setModality,
  showAdvancedFilter, setShowAdvancedFilter,
}) {
  return (
    <>
      <div style={styles.filterBar}>
        <div style={styles.filterGroup}>
          <span style={styles.filterLabel}>{t('dc.dateLabel')}</span>
          <select style={styles.select} value={dateRange} onChange={(e) => setDateRange(e.target.value)}>
            <option value="2026-05">2026年5月</option>
            <option value="2026-04">2026年4月</option>
            <option value="2026-03">2026年3月</option>
          </select>
        </div>
        <div style={styles.filterGroup}>
          <span style={styles.filterLabel}>{t('dc.modalityLabel')}</span>
          <select style={styles.select} value={modality} onChange={(e) => setModality(e.target.value)}>
            <option value="全部">{t('qcfilter.all')}</option>
            <option value="CT">CT</option>
            <option value="MR">MR</option>
            <option value="DR">DR</option>
            <option value="MG">MG</option>
            <option value="DSA">DSA</option>
          </select>
        </div>
        <div style={{ flex: 1 }} />
        <button style={{ ...styles.btn, ...styles.btnOutline }} onClick={() => setShowAdvancedFilter(!showAdvancedFilter)}>
          <Filter size={14} />{t('dc.advancedFilter')}
        </button>
      </div>
      {showAdvancedFilter && (
        <div style={{ ...styles.card, marginTop: "-8px" }}>
          <div style={{ padding: "16px 18px", display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
            <div style={styles.filterGroup}>
              <span style={styles.filterLabel}>报告医生:</span>
              <input style={styles.input} placeholder="请输入医生姓名" />
            </div>
            <div style={styles.filterGroup}>
              <span style={styles.filterLabel}>患者姓名:</span>
              <input style={styles.input} placeholder="请输入患者姓名" />
            </div>
            <div style={styles.filterGroup}>
              <span style={styles.filterLabel}>检查类型:</span>
              <select style={styles.select}>
                <option value="">{t('qcfilter.all')}</option>
                <option value="CT">CT</option>
                <option value="MR">MR</option>
                <option value="DR">DR</option>
                <option value="MG">MG</option>
                <option value="DSA">DSA</option>
              </select>
            </div>
            <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={() => setShowAdvancedFilter(false)}>{t('dc.applyFilter')}</button>
            <button style={{ ...styles.btn, ...styles.btnOutline }} onClick={() => setShowAdvancedFilter(false)}>{t('dcmtool.reset')}</button>
          </div>
        </div>
      )}
    </>
  );
}
