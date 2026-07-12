/**
 * G005 RIS v3.0.5.1 - R3.QUALITY REPORT 质控报表类型定义
 * A5-REPORT / 30 点
 *
 * 包含:
 *  - 月报 (MonthlyQualityReport) - 已在 R3.QUALITY.ts 中定义
 *  - 季报 (QuarterlyQualityReport)
 *  - 年报 (AnnualQualityReport)
 *  - 实时仪表盘 (QualityDashboard) - 已在 R3.QUALITY.ts 中定义
 *  - 报表生成配置
 *  - 报表导出/分享
 */
import type { QualityGrade, QualityDashboard, MonthlyQualityReport } from './R3.QUALITY';

// ============================================================
// 季报
// ============================================================

export interface QuarterlyQualityReport {
  id: string;
  year: number;
  quarter: 1 | 2 | 3 | 4;
  totalReports: number;
  avgScore: number;
  monthOverQuarter: number;
  gradeDistribution: Record<QualityGrade, number>;
  departmentRanking: Array<{ department: string; avgScore: number; total: number; rank: number }>;
  sections: Array<{ key: string; title: string; titleEn: string; content: string }>;
  fixRate: number;
  autoRate: number;
  generatedAt: string;
  generatedBy: string;
}

// ============================================================
// 年报
// ============================================================

export interface AnnualQualityReport {
  id: string;
  year: number;
  totalReports: number;
  avgScore: number;
  yearOverYear: number;
  gradeDistribution: Record<QualityGrade, number>;
  monthlyTrend: Array<{ month: number; avgScore: number; totalReports: number }>;
  annualTargets: {
    avgScoreTarget: number;
    avgScoreActual: number;
    gradeARate: number;
    fixRate: number;
  };
  sections: Array<{ key: string; title: string; titleEn: string; content: string }>;
  generatedAt: string;
  generatedBy: string;
}

// ============================================================
// 报表章节
// ============================================================

export type ReportSectionKey =
  | 'overview'
  | 'grade'
  | 'defect'
  | 'doctor'
  | 'department'
  | 'trend'
  | 'critical'
  | 'timeliness'
  | 'terminology'
  | 'training'
  | 'rectifications'
  | 'target'
  | 'risk'
  | 'improvement'
  | 'next';

export const REPORT_SECTION_LABEL: Record<ReportSectionKey, string> = {
  overview: '总览',
  grade: '等级分析',
  defect: '缺陷分析',
  doctor: '医生排名',
  department: '科室排名',
  trend: '趋势',
  critical: '危急值',
  timeliness: '时效',
  terminology: '术语',
  training: '培训',
  rectifications: '整改',
  target: '目标',
  risk: '风险',
  improvement: '改进',
  next: '下月计划',
};

export const REPORT_SECTION_LABEL_EN: Record<ReportSectionKey, string> = {
  overview: 'Overview',
  grade: 'Grade Analysis',
  defect: 'Defect Analysis',
  doctor: 'Doctor Ranking',
  department: 'Department Ranking',
  trend: 'Trend',
  critical: 'Critical Value',
  timeliness: 'Timeliness',
  terminology: 'Terminology',
  training: 'Training',
  rectifications: 'Rectifications',
  target: 'Target',
  risk: 'Risk',
  improvement: 'Improvement',
  next: 'Next Month Plan',
};

// ============================================================
// 仪表盘 (re-export, 与 R3.QUALITY 保持一致)
// ============================================================

export type { QualityDashboard };

// ============================================================
// 报表生成配置
// ============================================================

export type ReportFormat = 'pdf' | 'word' | 'excel' | 'html';

export interface ReportConfig {
  id: string;
  type: 'monthly' | 'quarterly' | 'annual' | 'custom';
  year: number;
  month?: number;
  quarter?: 1 | 2 | 3 | 4;
  format: ReportFormat;
  includeSections: ReportSectionKey[];
  recipients: string[];
  scheduleCron?: string; // cron 表达式
  autoGenerate: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// 报表导出记录
// ============================================================

export interface ReportExport {
  id: string;
  reportId: string;
  format: ReportFormat;
  filename: string;
  size: number;
  url: string;
  generatedBy: string;
  generatedAt: string;
  expiresAt?: string;
}

// ============================================================
// 仪表盘小卡片
// ============================================================

export interface DashboardCard {
  key: string;
  title: string;
  titleEn: string;
  value: number | string;
  unit?: string;
  change?: number;
  changeType?: 'up' | 'down' | 'flat';
  color: string;
  icon?: string;
  link?: string;
}

export const DASHBOARD_CARDS: DashboardCard[] = [
  { key: 'pending', title: '待评估', titleEn: 'Pending', value: 28, change: 5, changeType: 'up', color: '#f59e0b', icon: 'Layers' },
  { key: 'completed', title: '今日完成', titleEn: 'Completed Today', value: 142, change: 12, changeType: 'up', color: '#10b981', icon: 'CheckCircle2' },
  { key: 'inProgress', title: '评估中', titleEn: 'In Progress', value: 12, change: -2, changeType: 'down', color: '#3b82f6', icon: 'Zap' },
  { key: 'criticalMissed', title: '危急值漏报', titleEn: 'Critical Missed', value: 1, change: 0, changeType: 'flat', color: '#dc2626', icon: 'AlertTriangle' },
  { key: 'avgScore', title: '本月均分', titleEn: 'Avg Score', value: 85.6, change: 1.2, changeType: 'up', color: '#7c3aed', icon: 'Award' },
  { key: 'gradeA', title: '甲级率', titleEn: 'Grade A Rate', value: 0.45, unit: '%', change: 0.03, changeType: 'up', color: '#10b981', icon: 'TrendingUp' },
  { key: 'fixRate', title: '修复率', titleEn: 'Fix Rate', value: 0.82, unit: '%', change: 0.05, changeType: 'up', color: '#3b82f6', icon: 'Wrench' },
  { key: 'autoRate', title: '自动评估率', titleEn: 'Auto Eval Rate', value: 0.72, unit: '%', change: 0.08, changeType: 'up', color: '#7c3aed', icon: 'Sparkles' },
  { key: 'onTimeRate', title: '按时率', titleEn: 'On-time Rate', value: 0.93, unit: '%', change: 0.02, changeType: 'up', color: '#10b981', icon: 'Clock' },
];

// ============================================================
// 月报简要 (用于列表/侧栏)
// ============================================================

export interface MonthlyReportSummary {
  year: number;
  month: number;
  totalReports: number;
  avgScore: number;
  monthOverMonth: number;
  fixRate: number;
  autoRate: number;
  generatedAt: string;
}

// ============================================================
// 报表类型守卫
// ============================================================

export function isMonthlyReport(r: unknown): r is MonthlyQualityReport {
  return typeof r === 'object' && r !== null && 'monthOverMonth' in r && 'gradeDistribution' in r;
}

export function isQuarterlyReport(r: unknown): r is QuarterlyQualityReport {
  return typeof r === 'object' && r !== null && 'quarter' in r && 'monthOverQuarter' in r;
}

export function isAnnualReport(r: unknown): r is AnnualQualityReport {
  return typeof r === 'object' && r !== null && 'yearOverYear' in r && 'annualTargets' in r;
}

export type QualityKPI = any;
