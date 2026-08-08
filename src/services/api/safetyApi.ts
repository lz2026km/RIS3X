import { api, invalidateApiCache, invalidateApiCacheByPrefix } from './client'

const BASE = '/safety'

export type EventSeverity = 'near-miss' | 'minor' | 'moderate' | 'severe' | 'catastrophic'
export type EventStatus = 'reported' | 'investigating' | 'resolved' | 'closed'
export type EventCategory =
  | 'medication-error' | 'patient-identification' | 'contrast-reaction'
  | 'radiation-overdose' | 'fall' | 'specimen-error' | 'communication-failure'
  | 'equipment-malfunction' | 'information-loss' | 'other'

export interface AdverseEvent {
  id: string
  eventType: EventCategory
  severity: EventSeverity
  status: EventStatus
  description: string
  department: string
  reportedBy: string
  reportedAt: string
  patientId?: string
  patientName?: string
  location?: string
  contributingFactors?: string[]
  actionsTaken?: string[]
  rootCauseIds?: string[]
  resolvedAt?: string
  resolvedBy?: string
  closedAt?: string
  closedBy?: string
}

export interface AdverseEventTrend {
  period: string
  total: number
  bySeverity: Record<string, number>
  byCategory: Record<string, number>
}

export type RcaStatus = 'open' | 'analyzing' | 'capa-planned' | 'implementing' | 'verified' | 'closed'

export interface FishboneCategory {
  category: string
  causes: string[]
  subCauses?: { cause: string; details: string[] }[]
}

export interface FiveWhysAnalysis {
  problem: string
  whys: { level: number; question: string; answer: string }[]
  rootCause: string
}

export interface CapaPlan {
  id: string
  correctiveAction: string
  preventiveAction: string
  responsiblePerson: string
  deadline: string
  implementationStatus: 'pending' | 'in-progress' | 'completed'
  verificationMethod?: string
  verifiedBy?: string
  verifiedAt?: string
  effectivenessRating?: number
}

export interface RcaInvestigation {
  id: string
  adverseEventId: string
  eventTitle: string
  description?: string
  dateOccurred: string
  teamMembers?: string[]
  fishboneData?: FishboneCategory[]
  fiveWhys?: FiveWhysAnalysis[]
  rootCauses?: string[]
  capaPlans?: CapaPlan[]
  capaStatus: RcaStatus
  conclusion?: string
  lessonsLearned?: string
  closedAt?: string
  closedBy?: string
}

export type RiskLevel = 'very-low' | 'low' | 'medium' | 'high' | 'very-high'
export type RiskCategory = 'clinical' | 'operational' | 'regulatory' | 'financial' | 'it-security'
export type RiskStatus = 'identified' | 'mitigating' | 'monitoring' | 'closed'

export interface RiskItem {
  id: string
  riskType: string
  title: string
  category: RiskCategory
  description: string
  likelihood: number
  severity: number
  rpn: number
  riskLevel: RiskLevel
  status: RiskStatus
  identifiedBy: string
  identifiedAt: string
  mitigationPlan?: string
  mitigationOwner?: string
  mitigationDeadline?: string
  residualRpn?: number
  closedAt?: string
  closedBy?: string
}

export function calculateRiskLevel(rpn: number): RiskLevel {
  if (rpn >= 15) return 'very-high'
  if (rpn >= 10) return 'high'
  if (rpn >= 6) return 'medium'
  if (rpn >= 3) return 'low'
  return 'very-low'
}

// ── Adverse Events ──────────────────────────────────────────────

export async function createAdverseEvent(event: {
  eventType: EventCategory
  severity: EventSeverity
  description: string
  department: string
  reportedBy: string
  reportedAt?: string
  patientId?: string
  patientName?: string
  location?: string
  contributingFactors?: string[]
  actionsTaken?: string[]
  rootCauseIds?: string[]
}): Promise<AdverseEvent> {
  const res = await api.post<AdverseEvent>(`${BASE}/adverse-events`, {
    ...event,
    status: 'reported',
    reportedAt: event.reportedAt ?? new Date().toISOString(),
  })
  await invalidateApiCache(`${BASE}/adverse-events`)
  await invalidateApiCacheByPrefix(`${BASE}/adverse-events`)
  return res.data
}

export async function getAdverseEvents(filters?: {
  status?: EventStatus
  severity?: EventSeverity
  eventType?: EventCategory
}): Promise<AdverseEvent[]> {
  const params = new URLSearchParams()
  if (filters?.status) params.set('status', filters.status)
  if (filters?.severity) params.set('severity', filters.severity)
  if (filters?.eventType) params.set('eventType', filters.eventType)
  const qs = params.toString()
  const res = await api.get<AdverseEvent[]>(`${BASE}/adverse-events${qs ? '?' + qs : ''}`)
  return res.data
}

export async function getAdverseEvent(id: string): Promise<AdverseEvent | null> {
  const res = await api.get<AdverseEvent>(`${BASE}/adverse-events/${id}`)
  return res.data ?? null
}

export async function updateAdverseEvent(id: string, data: Partial<AdverseEvent>): Promise<AdverseEvent | null> {
  const res = await api.put<AdverseEvent>(`${BASE}/adverse-events/${id}`, data)
  await invalidateApiCache(`${BASE}/adverse-events/${id}`)
  await invalidateApiCacheByPrefix(`${BASE}/adverse-events`)
  return res.data ?? null
}

export async function deleteAdverseEvent(id: string): Promise<boolean> {
  const res = await api.delete<{ ok: boolean }>(`${BASE}/adverse-events/${id}`)
  await invalidateApiCache(`${BASE}/adverse-events/${id}`)
  await invalidateApiCacheByPrefix(`${BASE}/adverse-events`)
  return res.success
}

// ── RCA Investigations ─────────────────────────────────────────

export async function createRcaInvestigation(data: {
  adverseEventId: string
  eventTitle: string
  description?: string
  dateOccurred: string
  teamMembers?: string[]
  fishboneData?: FishboneCategory[]
  fiveWhys?: FiveWhysAnalysis[]
  rootCauses?: string[]
  capaPlans?: CapaPlan[]
  capaStatus?: RcaStatus
  conclusion?: string
  lessonsLearned?: string
}): Promise<RcaInvestigation> {
  const res = await api.post<RcaInvestigation>(`${BASE}/rca-investigations`, data)
  await invalidateApiCache(`${BASE}/rca-investigations`)
  await invalidateApiCacheByPrefix(`${BASE}/rca-investigations`)
  return res.data
}

export async function getRcaInvestigations(filters?: { capaStatus?: string }): Promise<RcaInvestigation[]> {
  const params = new URLSearchParams()
  if (filters?.capaStatus) params.set('capaStatus', filters.capaStatus)
  const qs = params.toString()
  const res = await api.get<RcaInvestigation[]>(`${BASE}/rca-investigations${qs ? '?' + qs : ''}`)
  return res.data
}

export async function getRcaInvestigation(id: string): Promise<RcaInvestigation | null> {
  const res = await api.get<RcaInvestigation>(`${BASE}/rca-investigations/${id}`)
  return res.data ?? null
}

export async function updateRcaInvestigation(id: string, data: Partial<RcaInvestigation>): Promise<RcaInvestigation | null> {
  const res = await api.put<RcaInvestigation>(`${BASE}/rca-investigations/${id}`, data)
  await invalidateApiCache(`${BASE}/rca-investigations/${id}`)
  await invalidateApiCacheByPrefix(`${BASE}/rca-investigations`)
  return res.data ?? null
}

export async function deleteRcaInvestigation(id: string): Promise<boolean> {
  const res = await api.delete<{ ok: boolean }>(`${BASE}/rca-investigations/${id}`)
  await invalidateApiCache(`${BASE}/rca-investigations/${id}`)
  await invalidateApiCacheByPrefix(`${BASE}/rca-investigations`)
  return res.success
}

// ── Risk Items ─────────────────────────────────────────────────

export async function createRiskItem(data: {
  riskType: string
  title: string
  category: RiskCategory
  description: string
  likelihood: number
  severity: number
  rpn?: number
  riskLevel?: RiskLevel
  status?: RiskStatus
  identifiedBy: string
  identifiedAt?: string
  mitigationPlan?: string
  mitigationOwner?: string
  mitigationDeadline?: string
  residualRpn?: number
}): Promise<RiskItem> {
  const rpn = data.rpn ?? data.likelihood * data.severity
  const level = data.riskLevel ?? calculateRiskLevel(rpn)
  const res = await api.post<RiskItem>(`${BASE}/risk-items`, {
    ...data,
    rpn,
    riskLevel: level,
    status: data.status ?? 'identified',
    identifiedAt: data.identifiedAt ?? new Date().toISOString(),
  })
  await invalidateApiCache(`${BASE}/risk-items`)
  await invalidateApiCacheByPrefix(`${BASE}/risk-items`)
  return res.data
}

export async function getRiskItems(filters?: { riskLevel?: string; status?: string }): Promise<RiskItem[]> {
  const params = new URLSearchParams()
  if (filters?.riskLevel) params.set('riskLevel', filters.riskLevel)
  if (filters?.status) params.set('status', filters.status)
  const qs = params.toString()
  const res = await api.get<RiskItem[]>(`${BASE}/risk-items${qs ? '?' + qs : ''}`)
  return res.data
}

export async function getRiskItem(id: string): Promise<RiskItem | null> {
  const res = await api.get<RiskItem>(`${BASE}/risk-items/${id}`)
  return res.data ?? null
}

export async function updateRiskItem(id: string, data: Partial<RiskItem>): Promise<RiskItem | null> {
  const res = await api.put<RiskItem>(`${BASE}/risk-items/${id}`, data)
  await invalidateApiCache(`${BASE}/risk-items/${id}`)
  await invalidateApiCacheByPrefix(`${BASE}/risk-items`)
  return res.data ?? null
}

export async function deleteRiskItem(id: string): Promise<boolean> {
  const res = await api.delete<{ ok: boolean }>(`${BASE}/risk-items/${id}`)
  await invalidateApiCache(`${BASE}/risk-items/${id}`)
  await invalidateApiCacheByPrefix(`${BASE}/risk-items`)
  return res.success
}

// ── Mock supplements (no backend endpoints yet) ────────────────

export interface DoseRecord {
  id: string
  examId: string
  patientId: string
  patientName: string
  modality: 'CT' | 'MR' | 'DR' | 'DSA' | 'MG'
  procedureName: string
  ctDoseIndex?: number
  dlp?: number
  kap?: number
  fluoroscopyTime?: number
  numberofFrames?: number
  examDate: string
  technologistId: string
  deviceId: string
  deviceName: string
  notes?: string
}

export interface AlaraComplianceStatus {
  modality: string
  period: string
  totalExams: number
  belowDiagnosticReference: number
  complianceRate: number
  avgDose: number
  referenceLevel: number
  status: 'compliant' | 'warning' | 'non-compliant'
}

export interface ProtocolOptimizationSuggestion {
  modality: string
  procedureName: string
  currentAvgDose: number
  recommendedTarget: number
  estimatedReduction: number
  actionItems: string[]
}

export interface AdverseEventTrendItem {
  period: string
  total: number
  bySeverity: Record<string, number>
  byCategory: Record<string, number>
}

export interface PatientSafetyGoal {
  id: string
  title: string
  description: string
  category: string
  target: number
  current: number
  unit: string
  baseline: number
  deadline: string
  status: 'on-track' | 'at-risk' | 'behind' | 'achieved'
  owner: string
}

export type CqiStatus = 'planning' | 'active' | 'sustaining' | 'closed'

export interface CqiIndicator {
  name: string
  currentValue: number
  baselineValue: number
  targetValue: number
  unit: string
  trend: 'up' | 'down' | 'stable'
  lastUpdated: string
}

export interface PdsaCycle {
  cycle: number
  plan: string
  do_: string
  study: string
  act: string
  startDate: string
  endDate: string
  outcome: string
  success: boolean
}

export interface CqiProject {
  id: string
  title: string
  description: string
  aim: string
  indicators: CqiIndicator[]
  pdsaCycles: PdsaCycle[]
  status: CqiStatus
  sponsor: string
  teamMembers: string[]
  startDate: string
  targetEndDate: string
  closedAt?: string
  lessonsLearned?: string
  sustainabilityPlan?: string
}

const MOCK_DOSE_RECORDS: DoseRecord[] = [
  { id: 'DR-001', examId: 'CT20250601-01', patientId: 'P2025001', patientName: '李明', modality: 'CT', procedureName: '头部CT平扫', ctDoseIndex: 45.2, dlp: 680, examDate: '2025-06-01', technologistId: 'T001', deviceId: 'DEV-CT-01', deviceName: 'GE Revolution CT' },
  { id: 'DR-002', examId: 'CT20250601-02', patientId: 'P2025002', patientName: '王芳', modality: 'CT', procedureName: '腹部CT增强', ctDoseIndex: 18.5, dlp: 920, examDate: '2025-06-01', technologistId: 'T002', deviceId: 'DEV-CT-01', deviceName: 'GE Revolution CT' },
  { id: 'DR-003', examId: 'XR20250601-03', patientId: 'P2025003', patientName: '张强', modality: 'DR', procedureName: '胸部正位', kap: 0.35, examDate: '2025-06-01', technologistId: 'T003', deviceId: 'DEV-XR-01', deviceName: 'Siemens Ysio' },
  { id: 'DR-004', examId: 'DSA20250602-01', patientId: 'P2025004', patientName: '赵丽', modality: 'DSA', procedureName: '冠脉造影', kap: 45.2, fluoroscopyTime: 12.5, numberofFrames: 380, examDate: '2025-06-02', technologistId: 'T004', deviceId: 'DEV-DSA-01', deviceName: 'Philips Azurion' },
  { id: 'DR-005', examId: 'CT20250602-02', patientId: 'P2025005', patientName: '刘伟', modality: 'CT', procedureName: '胸部CT平扫', ctDoseIndex: 12.8, dlp: 450, examDate: '2025-06-02', technologistId: 'T001', deviceId: 'DEV-CT-02', deviceName: 'Siemens SOMATOM Force' },
]

const MOCK_GOALS: PatientSafetyGoal[] = [
  { id: 'SG-001', title: '降低患者身份识别错误率', description: '通过双标识核对流程，将身份识别错误事件降至零', category: '身份识别', target: 0, current: 2, unit: '次/月', baseline: 5, deadline: '2025-12-31', status: 'on-track', owner: '质控办' },
  { id: 'SG-002', title: '提高手术安全核查执行率', description: '确保100%的手术/有创操作执行安全核查', category: '手术安全', target: 100, current: 96, unit: '%', baseline: 88, deadline: '2025-09-30', status: 'at-risk', owner: '护理部' },
  { id: 'SG-003', title: '降低对比剂外渗率', description: '将对比剂外渗率降至1%以下', category: '用药安全', target: 1, current: 1.8, unit: '%', baseline: 3.2, deadline: '2025-08-31', status: 'on-track', owner: '影像科' },
  { id: 'SG-004', title: '提高危急值报告及时率', description: '确保危急值15分钟内完成闭环报告', category: '危急值管理', target: 95, current: 92, unit: '%', baseline: 78, deadline: '2025-07-31', status: 'on-track', owner: '质控办' },
  { id: 'SG-005', title: '降低患者跌倒发生率', description: '通过风险评估和预防措施降低跌倒事件', category: '患者安全', target: 0.5, current: 1.2, unit: '‰', baseline: 2.5, deadline: '2025-12-31', status: 'at-risk', owner: '护理部' },
  { id: 'SG-006', title: '提高手卫生依从性', description: '提升全员手卫生依从性至95%以上', category: '感染控制', target: 95, current: 86, unit: '%', baseline: 72, deadline: '2025-10-31', status: 'behind', owner: '院感科' },
  { id: 'SG-007', title: '降低辐射剂量超标事件', description: '将CT辐射剂量DLP超标事件减少80%', category: '辐射安全', target: 0, current: 1, unit: '次/月', baseline: 5, deadline: '2025-12-31', status: 'on-track', owner: '设备科' },
  { id: 'SG-008', title: '提高患者满意度', description: '提升患者就医体验综合评分', category: '服务品质', target: 90, current: 83, unit: '分', baseline: 75, deadline: '2025-12-31', status: 'on-track', owner: '门诊部' },
]

const MOCK_CQI_PROJECTS: CqiProject[] = [
  {
    id: 'CQI-001', title: '降低CT增强检查对比剂外渗率',
    description: '通过流程优化和人员培训，将对比剂外渗率降低50%',
    aim: '在6个月内将对比剂外渗率从3.2%降至1.6%以下',
    indicators: [
      { name: '对比剂外渗率', currentValue: 1.8, baselineValue: 3.2, targetValue: 1.6, unit: '%', trend: 'down', lastUpdated: '2025-06-01' },
      { name: '高压注射器正确使用率', currentValue: 95, baselineValue: 82, targetValue: 98, unit: '%', trend: 'up', lastUpdated: '2025-06-01' },
      { name: '对比剂外渗处理规范执行率', currentValue: 100, baselineValue: 75, targetValue: 100, unit: '%', trend: 'up', lastUpdated: '2025-06-01' },
    ],
    pdsaCycles: [
      { cycle: 1, plan: '分析外渗原因，制定标准化操作流程', do_: '收集3个月外渗数据，开展根因分析，制定SOP草案', study: '外渗主要原因为穿刺技术不当和注射流速设置过高', act: '修订SOP，增加穿刺后回血确认步骤，降低初始流速', startDate: '2025-01-10', endDate: '2025-02-28', outcome: '外渗率降至2.5%', success: true },
      { cycle: 2, plan: '开展全员培训和模拟演练', do_: '组织4次专题培训，包含理论考核和实操演练', study: '培训后考核通过率98%，但部分高年资护士存在惯性操作', act: '建立月度技能复训机制，将SOP执行纳入绩效考核', startDate: '2025-03-01', endDate: '2025-04-15', outcome: '外渗率降至2.1%', success: true },
      { cycle: 3, plan: '引入智能外渗监测系统', do_: '与设备科协调，在3台CT高压注射器上加装外渗监测装置', study: '监测系统对外渗预警灵敏度达95%，显著减少了严重外渗', act: '推广至全部CT设备，建立外渗事件24小时上报制度', startDate: '2025-04-20', endDate: '2025-06-01', outcome: '外渗率降至1.8%', success: true },
    ],
    status: 'active', sponsor: '李主任',
    teamMembers: ['张护士长', '王医师', '赵质控员', '刘设备工程师'],
    startDate: '2025-01-10', targetEndDate: '2025-07-10',
    sustainabilityPlan: '每月监测外渗率，季度回顾SOP执行情况，半年更新一次培训材料',
  },
  {
    id: 'CQI-002', title: '缩短门诊CT检查报告出具时间',
    description: '优化报告流程，将门诊CT报告出具时间从平均4小时缩短至2小时内',
    aim: '在3个月内将门诊CT平扫报告出具时间缩短50%',
    indicators: [
      { name: '平均报告出具时间', currentValue: 2.5, baselineValue: 4.0, targetValue: 2.0, unit: '小时', trend: 'down', lastUpdated: '2025-06-01' },
      { name: '2小时内完成率', currentValue: 68, baselineValue: 42, targetValue: 85, unit: '%', trend: 'up', lastUpdated: '2025-06-01' },
      { name: '报告质量评分', currentValue: 92, baselineValue: 88, targetValue: 95, unit: '分', trend: 'up', lastUpdated: '2025-06-01' },
    ],
    pdsaCycles: [
      { cycle: 1, plan: '优化报告优先级分配', do_: '实施门诊CT报告优先级标签，分配专职医生优先处理', study: '平均时间从4小时降至3.2小时，但下午时段仍有积压', act: '增加下午班次报告医生人力，设置弹性排班', startDate: '2025-04-01', endDate: '2025-04-30', outcome: '平均时间降至3.0小时', success: true },
      { cycle: 2, plan: '引入AI辅助报告系统', do_: '部署CT平扫AI辅助排阴功能，正常报告自动生成模板', study: 'AI辅助使正常报告时间缩短60%，异常病例仍需人工', act: '优化AI与人工的接口流程，建立AI报告复核机制', startDate: '2025-05-01', endDate: '2025-05-31', outcome: '平均时间降至2.5小时', success: true },
    ],
    status: 'active', sponsor: '王主任',
    teamMembers: ['陈医生', '刘医生', '赵技师', '信息科李工'],
    startDate: '2025-04-01', targetEndDate: '2025-07-01',
  },
  {
    id: 'CQI-003', title: '提高危急值报告及时率',
    description: '通过流程再造实现危急值15分钟内闭环管理',
    aim: '将危急值报告及时率从78%提升至95%以上',
    indicators: [
      { name: '危急值报告及时率', currentValue: 92, baselineValue: 78, targetValue: 95, unit: '%', trend: 'up', lastUpdated: '2025-06-01' },
      { name: '平均报告响应时间', currentValue: 12, baselineValue: 22, targetValue: 10, unit: '分钟', trend: 'down', lastUpdated: '2025-06-01' },
      { name: '临床接收确认率', currentValue: 95, baselineValue: 82, targetValue: 98, unit: '%', trend: 'up', lastUpdated: '2025-06-01' },
    ],
    pdsaCycles: [
      { cycle: 1, plan: '建立危急值电子推送系统', do_: '与HIS对接实现危急值自动弹窗提醒临床医生', study: '推送后响应时间缩短，但部分医生未及时查看', act: '增加短信和电话二次提醒机制', startDate: '2025-02-01', endDate: '2025-03-15', outcome: '及时率提升至85%', success: true },
      { cycle: 2, plan: '建立危急值闭环管理流程', do_: '实施"报告-推送-确认-处理-反馈"五步闭环', study: '闭环流程执行后，确认率大幅提升', act: '将危急值管理纳入科室月度质控会议议题', startDate: '2025-03-16', endDate: '2025-05-01', outcome: '及时率提升至92%', success: true },
    ],
    status: 'sustaining', sponsor: '赵主任',
    teamMembers: ['钱医生', '孙护士', '李质控员'],
    startDate: '2025-02-01', targetEndDate: '2025-06-30',
    sustainabilityPlan: '月度监测危急值指标，季度开展流程审计',
  },
]

export async function getAdverseEventTrend(): Promise<AdverseEventTrendItem[]> {
  return [
    { period: '2025-01', total: 5, bySeverity: { 'near-miss': 2, minor: 2, moderate: 1, severe: 0, catastrophic: 0 }, byCategory: { 'medication-error': 0, 'patient-identification': 2, 'contrast-reaction': 1, 'radiation-overdose': 0, fall: 1, 'communication-failure': 1, 'equipment-malfunction': 0, 'information-loss': 0, other: 0 } },
    { period: '2025-02', total: 3, bySeverity: { 'near-miss': 1, minor: 1, moderate: 1, severe: 0, catastrophic: 0 }, byCategory: { 'medication-error': 0, 'patient-identification': 0, 'contrast-reaction': 1, 'radiation-overdose': 0, fall: 0, 'specimen-error': 1, 'communication-failure': 0, 'equipment-malfunction': 1, 'information-loss': 0, other: 0 } },
    { period: '2025-03', total: 7, bySeverity: { 'near-miss': 3, minor: 2, moderate: 1, severe: 1, catastrophic: 0 }, byCategory: { 'medication-error': 1, 'patient-identification': 1, 'contrast-reaction': 2, 'radiation-overdose': 1, fall: 0, 'specimen-error': 0, 'communication-failure': 1, 'equipment-malfunction': 1, 'information-loss': 0, other: 0 } },
    { period: '2025-04', total: 4, bySeverity: { 'near-miss': 2, minor: 1, moderate: 0, severe: 1, catastrophic: 0 }, byCategory: { 'medication-error': 0, 'patient-identification': 1, 'contrast-reaction': 0, 'radiation-overdose': 0, fall: 1, 'specimen-error': 0, 'communication-failure': 1, 'equipment-malfunction': 1, 'information-loss': 0, other: 0 } },
    { period: '2025-05', total: 6, bySeverity: { 'near-miss': 2, minor: 3, moderate: 0, severe: 1, catastrophic: 0 }, byCategory: { 'medication-error': 0, 'patient-identification': 2, 'contrast-reaction': 1, 'radiation-overdose': 1, fall: 0, 'specimen-error': 0, 'communication-failure': 0, 'equipment-malfunction': 1, 'information-loss': 1, other: 0 } },
  ]
}

export async function getDoseRecords(filters?: { modality?: string; patientId?: string; startDate?: string; endDate?: string }): Promise<DoseRecord[]> {
  let result = [...MOCK_DOSE_RECORDS]
  if (filters?.modality) result = result.filter(r => r.modality === filters.modality)
  if (filters?.patientId) result = result.filter(r => r.patientId === filters.patientId)
  if (filters?.startDate) result = result.filter(r => r.examDate >= filters.startDate!)
  if (filters?.endDate) result = result.filter(r => r.examDate <= filters.endDate!)
  return result
}

export async function checkAlaraCompliance(): Promise<AlaraComplianceStatus[]> {
  return [
    { modality: 'CT', period: '2025-05', totalExams: 320, belowDiagnosticReference: 298, complianceRate: 93.1, avgDose: 580, referenceLevel: 750, status: 'compliant' },
    { modality: 'DR', period: '2025-05', totalExams: 580, belowDiagnosticReference: 562, complianceRate: 96.9, avgDose: 0.28, referenceLevel: 0.5, status: 'compliant' },
    { modality: 'DSA', period: '2025-05', totalExams: 45, belowDiagnosticReference: 38, complianceRate: 84.4, avgDose: 52.3, referenceLevel: 60, status: 'warning' },
    { modality: 'MG', period: '2025-05', totalExams: 120, belowDiagnosticReference: 115, complianceRate: 95.8, avgDose: 1.8, referenceLevel: 2.5, status: 'compliant' },
  ]
}

export async function getProtocolOptimizationSuggestions(): Promise<ProtocolOptimizationSuggestion[]> {
  return [
    { modality: 'CT', procedureName: '腹部CT增强', currentAvgDose: 920, recommendedTarget: 750, estimatedReduction: 18.5, actionItems: ['启用迭代重建算法', '优化扫描期相', '降低管电流至Smart mA范围'] },
    { modality: 'CT', procedureName: '头部CT平扫', currentAvgDose: 680, recommendedTarget: 600, estimatedReduction: 11.8, actionItems: ['调整FOV至最小必要范围', '使用自动管电压选择'] },
    { modality: 'DSA', procedureName: '冠脉造影', currentAvgDose: 52.3, recommendedTarget: 45, estimatedReduction: 14.0, actionItems: ['优化透视脉冲频率', '使用路图引导减少曝光帧数', '启用剂量报告自动记录'] },
  ]
}

export async function getPatientSafetyGoals(): Promise<PatientSafetyGoal[]> {
  return [...MOCK_GOALS]
}

export async function createPatientSafetyGoal(goal: Omit<PatientSafetyGoal, 'id' | 'status'>): Promise<PatientSafetyGoal> {
  const newGoal: PatientSafetyGoal = {
    ...goal,
    id: `GOAL-${Date.now().toString(36).toUpperCase()}`,
    status: 'on-track',
  }
  MOCK_GOALS.unshift(newGoal)
  return newGoal
}

export async function getCqiDashboard(): Promise<CqiProject[]> {
  return [...MOCK_CQI_PROJECTS]
}

export async function createCqiProject(project: Omit<CqiProject, 'id' | 'status'>): Promise<CqiProject> {
  const newProject: CqiProject = {
    ...project,
    id: `CQI-${String(MOCK_CQI_PROJECTS.length + 1).padStart(3, '0')}`,
    status: 'planning',
  }
  MOCK_CQI_PROJECTS.unshift(newProject)
  return newProject
}

export async function closeCqiProject(projectId: string, lessonsLearned: string, sustainabilityPlan: string): Promise<CqiProject | undefined> {
  const project = MOCK_CQI_PROJECTS.find(p => p.id === projectId)
  if (!project) return undefined
  project.status = 'closed'
  project.closedAt = new Date().toISOString().slice(0, 10)
  project.lessonsLearned = lessonsLearned
  project.sustainabilityPlan = sustainabilityPlan
  return project
}
