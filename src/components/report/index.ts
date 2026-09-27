// ============================================================
// G005 放射科RIS系统 v1.0.1 - 报告组件统一导出
// Phase R0
// ============================================================

export { StatusBadge } from './StatusBadge';
export { StatusTimeline } from './StatusTimeline';
export {
  REPORT_STATUS_META,
  REPORT_STATUS_ORDER,
  REPORT_STATUS_GROUPS,
  normalizeReportStatus,
  LEGACY_STATUS_ALIAS,
  EN_STATE_TO_CN,
  displayStatus,
  toEnState,
  getReportStatusColor,
  getReportStatusBadge,
} from './statusMeta';
export type { ReportStatusMeta, SharedStatusColor } from './statusMeta';
