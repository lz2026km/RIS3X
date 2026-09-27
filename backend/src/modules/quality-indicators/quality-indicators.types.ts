/**
 * G005 放射RIS系统 v3.0.6.11-105 Wave 1C - 质量指标库镜像类型
 *
 * 与前端 src/data/qualityIndicators.ts + src/data/qualityStandards.ts 保持结构一致:
 *   - 40 条国家规范级质控指标 (结构 10 / 过程 18 / 结果 12)
 *   - 图像质量评分标准 (5 维度 × 5 级) / 报告质量标准 14 条 / 检查流程质控点
 * 孤儿模块模式: 无新增 DB 表 (不修改 prisma schema), 常量镜像保证 API 一致。
 */

/** 指标类别英文键 (API 口径) / Indicator category key */
export type QICategoryKey = 'structure' | 'process' | 'outcome'

/** 指标类别中文名 (前端数据口径) / Indicator category label */
export type QICategory = '结构' | '过程' | '结果'

export const QI_CATEGORY_KEYS: QICategoryKey[] = ['structure', 'process', 'outcome']

export const QI_CATEGORY_LABELS: Record<QICategoryKey, QICategory> = {
  structure: '结构',
  process: '过程',
  outcome: '结果',
}

/** 单条质控指标 / Quality indicator */
export interface QualityIndicator {
  code: string
  name: string
  nameEn: string
  category: QICategory
  categoryKey: QICategoryKey
  formula: string
  target: string
  frequency: string
  responsible: string
  threshold: string
}

/** 达标判定结果 / Target evaluation result */
export interface IndicatorEvaluation {
  code: string
  name: string
  value: number
  target: string
  targetValue: number
  unit: string
  direction: 'higher' | 'lower'
  passed: boolean
  comparison: string
}

/** 指标分类计数 / Category statistics */
export interface IndicatorCategoryStat {
  category: QICategory
  categoryKey: QICategoryKey
  count: number
}

/** 40 条指标库扩展返回 / Extended indicator list */
export interface IndicatorListResult {
  source: 'mirror'
  generatedAt: string
  total: number
  byCategory: Record<QICategoryKey, number>
  categoryStats: IndicatorCategoryStat[]
  data: QualityIndicator[]
}

// ------------------------- 质控标准 (qualityStandards) -------------------------

export interface ImageQualityLevel {
  score: number
  levelName: string
  levelNameEn: string
  description: string
  acceptable: boolean
}

export interface ImageQualityDimension {
  dimension: string
  dimensionEn: string
  weight: number
  levels: ImageQualityLevel[]
}

export interface ReportQualityItem {
  id: string
  category: string
  categoryEn: string
  item: string
  standard: string
  checkpoints: string[]
}

export interface WorkflowQcPoint {
  id: string
  stage: string
  stageEn: string
  item: string
  standard: string
  checkMethod: string
  responsible: string
  onFailure: string
}

export interface QualityStandardsResult {
  source: 'mirror'
  generatedAt: string
  imageDimensionCount: number
  reportStandardCount: number
  workflowPointCount: number
  imageQualityDimensions: ImageQualityDimension[]
  reportQualityStandards: ReportQualityItem[]
  workflowQcPoints: WorkflowQcPoint[]
}

// ------------------------- 2024 国标 40 指标计算引擎 -------------------------

export type QiComputeStatus = 'pass' | 'warn' | 'fail' | 'nodata'

export interface ComputedIndicator {
  code: string
  name: string
  category: QICategory
  categoryKey: QICategoryKey
  formula: string
  target: string
  frequency: string
  responsible: string
  numerator: number
  denominator: number
  rate: number
  unit: string
  direction: 'higher' | 'lower'
  status: QiComputeStatus
  /** true = 由报告/检查/危急值/审计/设备数据实时计算; false = 管理类指标回退 seed 估计 */
  computable: boolean
  source: 'derived' | 'seed'
}

export interface ComputedSnapshot {
  id: string
  generatedAt: string
  period: string
  dateFrom: string
  dateTo: string
  indicatorCount: number
  indicators: ComputedIndicator[]
  persisted: true
}

export interface ComputedDashboard {
  source: 'database' | 'seed'
  generatedAt: string
  period: string
  standard: string
  total: number
  computableCount: number
  passCount: number
  warnCount: number
  failCount: number
  nodataCount: number
  passRate: number
  byCategory: Array<{
    categoryKey: QICategoryKey
    category: QICategory
    total: number
    passCount: number
    warnCount: number
    failCount: number
    nodataCount: number
    passRate: number
  }>
  indicators: ComputedIndicator[]
}

export interface QiSourceDataset {
  reports: Array<{
    id: string
    modality: string
    bodyPart: string
    isEmergency: boolean
    examStartedAt: string
    reportIssuedAt: string
    hasSignature: boolean
    conclusionMatches: boolean
    hasError: boolean
    radsCategory: string
    isEnhanced: boolean
    extravasation: boolean
    isProstateMr: boolean
    isMammo: boolean
    submittedAt: string
    reviewedAt: string
    qualityScore: number
  }>
  exams: Array<{
    id: string
    modality: string
    bodyPart: string
    startedAt: string
    hasArtifact: boolean
    doseRecorded: boolean
  }>
  criticals: Array<{
    id: string
    foundAt: string
    notifiedAt?: string
    hasCompleteRecord: boolean
  }>
  devices: Array<{ id: string; modality: string; inService: boolean; todayExams: number }>
  generatedAt: string
  source: 'database' | 'seed'
}
