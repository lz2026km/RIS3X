// @ts-nocheck
import { Database, Calendar, RefreshCw } from "lucide-react";
import { t } from '../../i18n/appI18n';
import { COLORS, styles } from './DataReportCharts';

export default function DataReportHeader({ dateRange, onDateChange, onRefresh }) {
  return (
    <div style={styles.header}>
      <div>
        <div style={styles.headerTitle}>
          <Database size={24} />{t('dc.title')}
        </div>
        <div style={styles.headerSubtitle}>
          数据导出上报 / 检查量统计 / 设备使用率 / 报告质量 / 辐射剂量 / 会诊统计 / 自定义报表 / 调度分发 / 下钻导航 / OLAP筛选 / 标杆对比
        </div>
      </div>
      <div style={styles.headerActions}>
        <button style={styles.headerBtn} onClick={() => onDateChange(dateRange)}>
          <Calendar size={14} />
          {dateRange}
        </button>
        <button style={styles.headerBtn} onClick={onRefresh}>
          <RefreshCw size={14} />{t('dc.refresh')}
        </button>
      </div>
    </div>
  );
}
