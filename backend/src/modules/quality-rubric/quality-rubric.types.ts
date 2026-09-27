/**
 * [G005 W9-QC] 统一可配置质控评分量表 (quality-rubric) 类型定义
 *
 * 设计目标: 取代历史上 8 / 5 / 15 维度并存的计算口径, 收敛为 "单一加权模型":
 *   QualityRubric = dimensions[] (权重) → subItems[] (权重) → rules[] (权重 + 判定规则)
 *   + gradeBands (等级带) + passThreshold / bonusThreshold + hardFailPatterns (一票否决)
 *
 * 默认量表由前端 15 维度 (5 完整 + 5 准确 + 5 时效) 迁移而来, 并对外口径对齐
 * 国卫办医政函〔2024〕150 号《放射影像专业医疗质量控制指标 (2024 年版)》。
 *
 * 孤儿模块模式: 不新增 DB 表; 量表内存持久化, 可无 DB 启动, 所有计算为纯函数。
 */

/** 规则判定类型 / Rule evaluation kind */
export type RubricRuleKind =
  | 'presence' // 文本出现 pattern → 通过
  | 'absence' // 文本未出现 pattern → 通过
  | 'minLength' // 字段长度 ≥ min → 按比例得分
  | 'minRatio' // 数值字段 ≥ min → 按比例得分
  | 'booleanTrue' // 布尔字段为真 → 通过
  | 'intervalMinutes' // to - from ≤ max 分钟 → 通过
  | 'priorityStat' // priority === 'stat' → 通过
  | 'leftRightOk' // 方位无矛盾 → 通过 (leftRightOk 布尔)

/** 量表提交字段 (评分输入) / Submission evaluated by the rubric */
export interface RubricSubmission {
  reportId?: string
  patientName?: string
  modality?: string
  findings?: string
  impression?: string
  diagnosis?: string
  recommendation?: string
  structuredFieldsComplete?: number
  signed?: boolean
  criticalMarked?: boolean
  priority?: 'stat' | 'urgent' | 'routine' | string
  leftRightOk?: boolean
  onTimeRate?: number
  submitAt?: string
  reviewStartedAt?: string
  signedAt?: string
  hasReviewerSignature?: boolean
  criticalNotified?: boolean
  criticalAcked?: boolean
  priorityQueue?: boolean
}

/** 单条评分规则 / Single scoring rule */
export interface RubricRule {
  key: string
  name: string
  nameEn?: string
  weight: number
  kind: RubricRuleKind
  field?: keyof RubricSubmission
  pattern?: string
  min?: number
  from?: keyof RubricSubmission
  to?: keyof RubricSubmission
  max?: number
  explanation?: string
}

/** 评分子项 (前端 15 维度的单维) / Sub-item (one of the 15 migrated dimensions) */
export interface RubricSubItem {
  key: string
  name: string
  nameEn?: string
  weight: number
  description?: string
  rules: RubricRule[]
}

/** 评分维度 (完整/准确/时效 等) / Dimension grouping sub-items */
export interface RubricDimension {
  key: string
  name: string
  nameEn?: string
  weight: number
  description?: string
  subItems: RubricSubItem[]
}

/** 等级带 / Grade band */
export interface GradeBand {
  grade: string
  min: number
  max: number
  label: string
  labelEn?: string
  publishable: boolean
  bonusEligible: boolean
  color: string
}

/** 统一加权量表 / Unified weighted rubric */
export interface QualityRubric {
  id: string
  name: string
  nameEn?: string
  version: number
  standard: string
  passThreshold: number
  bonusThreshold: number
  dimensions: RubricDimension[]
  gradeBands: GradeBand[]
  /** 一票否决规则 (文本正则): 命中即重写 / Hard-fail patterns */
  hardFailPatterns: string[]
  updatedAt: string
  updatedBy: string
}

// ------------------------- 评分结果 -------------------------

export interface RuleScore {
  key: string
  name: string
  score: number
  weight: number
  passed: boolean
  explanation: string
}

export interface SubItemScore {
  key: string
  name: string
  weight: number
  score: number
  passed: boolean
  rules: RuleScore[]
}

export interface DimensionScoreResult {
  key: string
  name: string
  weight: number
  score: number
  weightedScore: number
  subItems: SubItemScore[]
}

export interface RubricEvaluationResult {
  evaluationId: string
  rubricId: string
  rubricVersion: number
  reportId?: string
  modality?: string
  totalScore: number
  grade: string
  gradeLabel: string
  passed: boolean
  publishable: boolean
  bonusEligible: boolean
  hardFailTriggered: string[]
  dimensions: DimensionScoreResult[]
  evaluatedAt: string
  standard: string
}

export interface RubricUpdateInput {
  name?: string
  passThreshold?: number
  bonusThreshold?: number
  dimensions?: RubricDimension[]
  gradeBands?: GradeBand[]
  hardFailPatterns?: string[]
  updatedBy?: string
}
