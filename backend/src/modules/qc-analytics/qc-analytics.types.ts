/**
 * G005 放射RIS系统 v3.0.6.11-101 Wave 8B (qc-analytics) - 报告质控闭环与趋势分析类型定义
 *
 * 桥接模块: 数据从报告规则引擎违规 (auditLog 'report-rule-violation') 与报告质控 V2
 * (auditLog 'report-qc-v2') 派生, DB 不可用时回退确定性种子 (孤儿模块, 可无 DB 启动)。
 * 缺陷类型沿用规则引擎 rule type + 质控 V2 维度语义, 保证跨模块口径一致。
 */

export type DefectTypeCode =
  | 'missing_field'
  | 'terminology'
  | 'unit'
  | 'length_range'
  | 'numeric_reasonability'
  | 'duplicate'
  | 'structure'
  | 'critical'

/** 缺陷来源: 规则引擎违规 / 质控 V2 评分 / 人工登记 */
export type DefectSource = 'rules-engine' | 'qc-v2' | 'manual'

export interface DefectTypeMeta {
  code: DefectTypeCode
  label: string
  category: 'rules-engine' | 'qc-v2'
}

/** 报告样本记录 (趋势/帕累托/科室排名的原始数据单元) */
export interface QcReportRecord {
  id: string
  reportId: string
  department: string
  modality: string
  reportedAt: string
  defectCodes: DefectTypeCode[]
  qcScored: boolean
  score?: number
  responseMinutes: number
  timely: boolean
}

/** 闭环状态机: open(待整改) → rectifying(整改中) → rechecking(复查验证中) → closed(关闭) */
export type LoopStatus = 'open' | 'rectifying' | 'rechecking' | 'closed'

export interface LoopDefect {
  id: string
  code: DefectTypeCode
  typeLabel: string
  reportId: string
  department: string
  severity: 'high' | 'medium' | 'low'
  source: DefectSource
  message: string
  discoveredAt: string
  /** 派生状态: 无整改任务 → open, 有任务 → 跟随任务状态 */
  status: LoopStatus
  itemId?: string
}

export interface LoopHistoryEntry {
  at: string
  action: string
  actor: string
  note: string
}

/** 整改任务 (PDCA 数字化闭环的 D/C/A 载体) */
export interface RectificationItem {
  id: string
  defectId: string
  defectCode: DefectTypeCode
  typeLabel: string
  reportId: string
  department: string
  severity: string
  source: DefectSource
  title: string
  assignee: string
  assigneeName: string
  status: LoopStatus
  createdAt: string
  updatedAt: string
  closedAt?: string
  fixNote?: string
  recheckResult?: 'pass' | 'fail'
  recheckNote?: string
  recheckRounds: number
  history: LoopHistoryEntry[]
}

export interface LoopStats {
  total: number
  byStatus: Record<LoopStatus, number>
  closureRate: number
  avgDaysToClose: number
  avgRecheckRounds: number
  openDefects: number
}

/** 质控驾驶舱聚合指标 */
export interface DashboardData {
  source: 'database' | 'demo'
  generatedAt: string
  totalReports: number
  qcReports: number
  qcRate: number
  totalDefects: number
  defectRate: number
  timelyReports: number
  timelyRate: number
  avgResponseMinutes: number
  avgScore: number
  loopOpen: number
  loopClosed: number
  closureRate: number
}

export interface TrendPoint {
  bucket: string
  label: string
  reports: number
  qcReports: number
  qcRate: number
  defects: number
  defectRate: number
  timely: number
  timelyRate: number
  avgResponseMinutes: number
  /** 环比改善率 (%) = (上期缺陷率 - 本期缺陷率) / 上期缺陷率, 首期为 null */
  improvement: number | null
}

export interface AnalyticsTrends {
  source: 'database' | 'demo'
  generatedAt: string
  period: 'week' | 'month'
  points: TrendPoint[]
}

export interface ParetoItem {
  code: DefectTypeCode
  label: string
  count: number
  cumulativeCount: number
  /** 累计占比 (%) */
  cumulativePercent: number
  /** 累计占比 ≤ 80% → 主要问题 */
  isMain: boolean
}

export interface ParetoData {
  source: 'database' | 'demo'
  generatedAt: string
  totalDefects: number
  items: ParetoItem[]
}

export interface DepartmentRankItem {
  department: string
  reports: number
  defects: number
  defectRate: number
  timelyRate: number
  avgResponseMinutes: number
  qcRate: number
  avgScore: number
}

export interface DepartmentRanking {
  source: 'database' | 'demo'
  generatedAt: string
  data: DepartmentRankItem[]
}

export const DEFECT_TYPE_META: DefectTypeMeta[] = [
  { code: 'missing_field', label: '必填字段缺失', category: 'rules-engine' },
  { code: 'terminology', label: '术语不规范', category: 'rules-engine' },
  { code: 'unit', label: '单位缺失', category: 'rules-engine' },
  { code: 'length_range', label: '长度异常', category: 'rules-engine' },
  { code: 'numeric_reasonability', label: '数值不合理', category: 'rules-engine' },
  { code: 'duplicate', label: '重复表述', category: 'rules-engine' },
  { code: 'structure', label: '结构不完整', category: 'qc-v2' },
  { code: 'critical', label: '危急提示缺失', category: 'qc-v2' },
]

export const DEFECT_TYPE_CODES: DefectTypeCode[] = DEFECT_TYPE_META.map((d) => d.code)

export const DEFECT_LABEL: Record<DefectTypeCode, string> = Object.fromEntries(
  DEFECT_TYPE_META.map((d) => [d.code, d.label]),
) as Record<DefectTypeCode, string>
