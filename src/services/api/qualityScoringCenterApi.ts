/**
 * [G005 W9-QC] 统一质控评分台 API (qualityScoringCenterApi)
 * 后端: quality-rubric / quality-indicators(compute) / qc-pdca(actions) / dual-read(sampling) /
 *       report-peer-review(defects) / equipment-qc / defect-library
 * 孤儿模块: 无 DB 自动 seed 回退; MSW w9QcHandlers 提供确定性演示数据。
 */
import { api, invalidateApiCache } from './client'

// ================= 统一量表 / 评分 =================

export type RubricRuleKind =
  | 'presence'
  | 'absence'
  | 'minLength'
  | 'minRatio'
  | 'booleanTrue'
  | 'intervalMinutes'
  | 'priorityStat'
  | 'leftRightOk'

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
  priority?: string
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

export interface RubricSubItem {
  key: string
  name: string
  nameEn?: string
  weight: number
  description?: string
  rules: RubricRule[]
}

export interface RubricDimension {
  key: string
  name: string
  nameEn?: string
  weight: number
  description?: string
  subItems: RubricSubItem[]
}

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
  hardFailPatterns: string[]
  updatedAt: string
  updatedBy: string
}

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

export interface RubricStats {
  rubricId: string
  version: number
  dimensionCount: number
  subItemCount: number
  ruleCount: number
  evaluations: number
  standard: string
}

// ================= 40 指标计算引擎 =================

export type QiComputeStatus = 'pass' | 'warn' | 'fail' | 'nodata'
export type QiCategoryKey = 'structure' | 'process' | 'outcome'

export interface ComputedIndicator {
  code: string
  name: string
  category: string
  categoryKey: QiCategoryKey
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
  persisted: boolean
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
    categoryKey: QiCategoryKey
    category: string
    total: number
    passCount: number
    warnCount: number
    failCount: number
    nodataCount: number
    passRate: number
  }>
  indicators: ComputedIndicator[]
}

// ================= PDCA 整改措施 =================

export type PdcaActionStatus = 'pending' | 'in_progress' | 'done' | 'overdue'
export type PdcaPhaseCode = 'plan' | 'do' | 'check' | 'act' | 'completed'

export interface PdcaAction {
  id: string
  cycleId: string
  phase: Exclude<PdcaPhaseCode, 'completed'>
  description: string
  ownerId: string
  ownerName: string
  deadline: string
  status: PdcaActionStatus
  createdAt: string
  completedAt?: string
}

export interface PdcaFinding {
  id: string
  cycleId: string
  title: string
  description: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  source: string
  createdAt: string
}

export interface PdcaMetrics {
  cycleCount: number
  actionCount: number
  actionDone: number
  actionOverdue: number
  actionCompletionRate: number
  findingCount: number
  byOwner: Array<{ ownerId: string; ownerName: string; total: number; done: number; overdue: number }>
  byActionStatus: Record<PdcaActionStatus, number>
  defectCount: number
  linkedDefectCount: number
}

// ================= 抽查 / 双盲 / 一致性 =================

export type SamplingMethod = 'random' | 'low_yield' | 'stratified'
export type SamplingReadingResult = 'positive' | 'negative' | 'indeterminate'

export interface SamplingItemView {
  itemId: string
  reportId: string
  patientName: string
  modality: string
  yielder: 'high' | 'low'
  stratum: string
  recordedCount: number
  readings: Array<{ readerSlot: 1 | 2; readerLabel: string; result: SamplingReadingResult | null; recordedAt: string }>
}

export interface SamplingBatchView {
  id: string
  name: string
  method: SamplingMethod
  blind: boolean
  targetSize: number
  modality?: string
  status: 'open' | 'closed'
  createdBy: string
  createdAt: string
  itemCount: number
  items: SamplingItemView[]
}

export interface AgreementResult {
  evaluatedItems: number
  positiveAgreement: number
  negativeAgreement: number
  agreementRate: number
  observedAgreement: number
  expectedAgreement: number
  kappa: number
  interpretation: string
}

export interface SamplingStats {
  batchCount: number
  openBatchCount: number
  itemCount: number
  recordedPairs: number
  pendingItems: number
  agreement: AgreementResult
  byModality: Array<{ modality: string; items: number; recordedPairs: number }>
}

// ================= 互评缺陷 / 缺陷库 =================

export interface DefectCategory {
  id: string
  code: string
  name: string
  nameEn?: string
  description: string
}

export interface DefectItem {
  id: string
  code: string
  categoryCode: string
  name: string
  nameEn?: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  standard?: string
  checkMethod?: string
}

export interface DefectAggregation {
  total: number
  byCategory: Array<{ categoryCode: string; categoryName: string; count: number }>
  bySeverity: Array<{ severity: string; count: number }>
  byCategorySeverity: Array<{ categoryCode: string; severity: string; count: number }>
}

// ================= 设备质控 =================

export type EquipmentModality = 'CT' | 'DR' | 'MRI' | 'MG'
export type QcFrequency = 'daily' | 'weekly' | 'monthly'

export interface PhantomTestItem {
  id: string
  modality: EquipmentModality
  frequency: QcFrequency
  name: string
  nameEn?: string
  standard: string
  threshold: { op: 'lte' | 'gte' | 'range'; limit: number; limit2?: number; unit: string }
  method: string
}

export interface EquipmentQcRecord {
  id: string
  deviceId: string
  deviceName: string
  modality: EquipmentModality
  frequency: QcFrequency
  testItemId: string
  testItemName: string
  value: number
  unit: string
  passed: boolean
  deviation: number
  testedAt: string
  testerId: string
  testerName: string
  note?: string
}

export interface EquipmentQcStats {
  total: number
  passed: number
  failed: number
  passRate: number
  byModality: Array<{ modality: EquipmentModality; total: number; passed: number; failed: number; passRate: number }>
  byFrequency: Array<{ frequency: QcFrequency; total: number; passed: number; failed: number; passRate: number }>
  recentFailureCount: number
}

// [G005 W-D4] 设备质控排程行 (GET /equipment-qc/schedule, 模态 × 频次)
export interface EquipmentQcScheduleRow {
  modality: EquipmentModality
  frequency: QcFrequency
  itemCount: number
  deviceCount: number
  items: Array<{ id: string; name: string; standard: string; threshold: string }>
}

// ================= 内部工具 =================

function buildQuery(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    search.set(key, String(value))
  }
  const qs = search.toString()
  return qs ? `?${qs}` : ''
}

// ================= API =================

export const qualityScoringCenterApi = {
  // --- 统一量表 ---
  getRubric: () => api.get<QualityRubric>('/quality/rubric'),
  updateRubric: async (data: Partial<Pick<QualityRubric, 'name' | 'passThreshold' | 'bonusThreshold' | 'dimensions' | 'gradeBands' | 'hardFailPatterns'>>) => {
    const res = await api.put<QualityRubric>('/quality/rubric', data)
    await invalidateApiCache('/quality/rubric')
    return res
  },
  resetRubric: async () => {
    const res = await api.post<QualityRubric>('/quality/rubric/reset', {})
    await invalidateApiCache('/quality/rubric')
    return res
  },
  getGradeBands: () => api.get<GradeBand[]>('/quality/rubric/grade-bands'),
  getRubricStats: () => api.get<RubricStats>('/quality/rubric/stats'),
  evaluate: (input: { reportId?: string; submission?: RubricSubmission }) =>
    api.post<RubricEvaluationResult>('/quality/rubric/evaluate', input),

  // --- 40 指标计算引擎 ---
  computeIndicators: (period?: string) =>
    api.get<ComputedSnapshot>(`/quality-indicators/compute${buildQuery({ period })}`),
  getIndicatorDashboard: (period?: string) =>
    api.get<ComputedDashboard>(`/quality-indicators/dashboard${buildQuery({ period })}`),
  // [G005 W4B] 指标快照历史 (GET /quality-indicators/snapshots)
  listSnapshots: () => api.get<ComputedSnapshot[]>('/quality-indicators/snapshots'),

  // --- PDCA 整改措施 ---
  listActions: (cycleId: string) => api.get<PdcaAction[]>(`/qc-pdca/cycles/${cycleId}/actions`),
  addAction: async (cycleId: string, data: { description: string; phase?: Exclude<PdcaPhaseCode, 'completed'>; ownerId?: string; deadline?: string }) => {
    const res = await api.post<PdcaAction>(`/qc-pdca/cycles/${cycleId}/actions`, data)
    await invalidateApiCache(`/qc-pdca/cycles/${cycleId}`)
    return res
  },
  updateAction: (actionId: string, data: Partial<{ description: string; phase: Exclude<PdcaPhaseCode, 'completed'>; ownerId: string; deadline: string; status: PdcaActionStatus }>) =>
    api.patch<PdcaAction>(`/qc-pdca/actions/${actionId}`, data),
  completeAction: (actionId: string) => api.post<PdcaAction>(`/qc-pdca/actions/${actionId}/complete`, {}),
  deleteAction: (actionId: string) => api.delete<{ id: string; deleted: boolean }>(`/qc-pdca/actions/${actionId}`),
  listFindings: (cycleId: string) => api.get<PdcaFinding[]>(`/qc-pdca/cycles/${cycleId}/findings`),
  addFinding: (cycleId: string, data: { title: string; description?: string; severity?: string; source?: string }) =>
    api.post<PdcaFinding>(`/qc-pdca/cycles/${cycleId}/findings`, data),
  getPdcaMetrics: () => api.get<PdcaMetrics>('/qc-pdca/metrics'),

  // --- 抽查 / 双盲 / 一致性 ---
  listSamplingBatches: () => api.get<SamplingBatchView[]>('/dual-read/sampling/batches'),
  createSamplingBatch: async (data: { name?: string; method?: SamplingMethod; size?: number; modality?: string; blind?: boolean; createdBy?: string }) => {
    const res = await api.post<SamplingBatchView>('/dual-read/sampling/batches', data)
    await invalidateApiCache('/dual-read/sampling/batches')
    return res
  },
  getSamplingBatch: (id: string, unblind = false) =>
    api.get<SamplingBatchView>(`/dual-read/sampling/batches/${id}${buildQuery({ unblind })}`),
  recordSamplingReading: (id: string, itemId: string, data: { readerSlot: 1 | 2; readerId: string; readerName: string; result: SamplingReadingResult; report?: string }) =>
    api.post<SamplingBatchView>(`/dual-read/sampling/batches/${id}/items/${encodeURIComponent(itemId)}/record`, data),
  closeSamplingBatch: (id: string) => api.post<SamplingBatchView>(`/dual-read/sampling/batches/${id}/close`, {}),
  getAgreement: (batchId?: string) => api.get<AgreementResult>(`/dual-read/agreement${buildQuery({ batchId })}`),
  getSamplingStats: () => api.get<SamplingStats>('/dual-read/sampling/stats'),

  // --- 互评缺陷 / 缺陷库 ---
  listDefectCategories: () => api.get<DefectCategory[]>('/defect-library/categories'),
  listDefectItems: (params: { categoryCode?: string; severity?: string; keyword?: string } = {}) =>
    api.get<DefectItem[]>(`/defect-library/items${buildQuery(params)}`),
  // [G005 W4A] 缺陷项详情 / 更新 / 删除
  getDefectItem: (id: string) => api.get<DefectItem>(`/defect-library/items/${encodeURIComponent(id)}`),
  updateDefectItem: async (id: string, data: Partial<Omit<DefectItem, 'id' | 'code'>>) => {
    const res = await api.patch<DefectItem>(`/defect-library/items/${encodeURIComponent(id)}`, data)
    await invalidateApiCache('/defect-library/items')
    return res
  },
  deleteDefectItem: async (id: string) => {
    const res = await api.delete<{ id: string; deleted: boolean }>(`/defect-library/items/${encodeURIComponent(id)}`)
    await invalidateApiCache('/defect-library/items')
    return res
  },
  getDefectAggregation: () => api.get<DefectAggregation>('/defect-library/aggregation'),
  getPeerReviewDefectStats: () =>
    api.get<{ totalLinks: number; byCode: Array<{ code: string; count: number }>; byCategory: Array<{ categoryCode: string; count: number }>; bySeverity: Array<{ severity: string; count: number }> }>(
      '/report-peer-review/defect-stats',
    ),

  // --- 设备质控 ---
  listEquipmentItems: (params: { modality?: EquipmentModality; frequency?: QcFrequency } = {}) =>
    api.get<PhantomTestItem[]>(`/equipment-qc/items${buildQuery(params)}`),
  // [G005 W4B] 设备质控项详情 (GET /equipment-qc/items/:id)
  getEquipmentItem: (id: string) => api.get<PhantomTestItem>(`/equipment-qc/items/${encodeURIComponent(id)}`),
  getEquipmentSchedule: () => api.get<EquipmentQcScheduleRow[]>('/equipment-qc/schedule'),
  listEquipmentRecords: (params: { deviceId?: string; modality?: EquipmentModality; frequency?: QcFrequency; onlyFailed?: boolean } = {}) =>
    api.get<EquipmentQcRecord[]>(`/equipment-qc/records${buildQuery(params)}`),
  createEquipmentRecord: async (data: { deviceId: string; deviceName?: string; modality: EquipmentModality; testItemId: string; value: number; testerName?: string; note?: string }) => {
    const res = await api.post<EquipmentQcRecord>('/equipment-qc/records', data)
    await invalidateApiCache('/equipment-qc/records')
    return res
  },
  getEquipmentStats: () => api.get<EquipmentQcStats>('/equipment-qc/stats'),
  listEquipmentFailures: () => api.get<EquipmentQcRecord[]>('/equipment-qc/failures'),
}

export default qualityScoringCenterApi
