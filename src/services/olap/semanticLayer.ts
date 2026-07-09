import type { MetricDefinition, DimensionDefinition, OLAPQuery, OLAPFilter, QueryResult, MetadataResponse } from './types'

const API_BASE = '/api/v1/olap'

export const metrics: MetricDefinition[] = [
  { id: 'exam_count', name: '检查量', dimension: 'exam', aggregation: 'count', format: 'number', description: '检查总人次' },
  { id: 'exam_revenue', name: '检查收入', dimension: 'exam', aggregation: 'sum', format: 'currency', unit: '元', description: '检查总收入金额' },
  { id: 'exam_cost', name: '检查成本', dimension: 'exam', aggregation: 'sum', format: 'currency', unit: '元', description: '检查总成本' },
  { id: 'avg_exam_time', name: '平均检查时长', dimension: 'exam', aggregation: 'avg', format: 'duration', unit: 'min', description: '平均每项检查耗时' },
  { id: 'avg_report_time', name: '平均报告时长', dimension: 'report', aggregation: 'avg', format: 'duration', unit: 'min', description: '报告从创建到审核平均时长' },
  { id: 'report_count', name: '报告量', dimension: 'report', aggregation: 'count', format: 'number', description: '报告总数' },
  { id: 'report_revision_count', name: '报告修订次数', dimension: 'report', aggregation: 'sum', format: 'number', description: '报告修订总次数' },
  { id: 'quality_score_avg', name: '平均质控评分', dimension: 'quality', aggregation: 'avg', format: 'decimal', unit: '分', description: '质控平均得分' },
  { id: 'quality_excellent_rate', name: '优秀率', dimension: 'quality', aggregation: 'avg', format: 'percent', description: '质控评分优秀比例' },
  { id: 'quality_pass_rate', name: '合格率', dimension: 'quality', aggregation: 'avg', format: 'percent', description: '质控评分合格比例' },
  { id: 'critical_count', name: '危急值数量', dimension: 'critical', aggregation: 'count', format: 'number', description: '危急值报告数' },
  { id: 'critical_response_time', name: '危急值响应时长', dimension: 'critical', aggregation: 'avg', format: 'duration', unit: 'min', description: '危急值平均响应时间' },
  { id: 'critical_notification_rate', name: '危急值通报率', dimension: 'critical', aggregation: 'avg', format: 'percent', description: '危急值及时通报比例' },
  { id: 'device_usage_rate', name: '设备使用率', dimension: 'device', aggregation: 'avg', format: 'percent', description: '设备平均使用率' },
  { id: 'device_daily_exams', name: '设备日均检查量', dimension: 'device', aggregation: 'avg', format: 'number', description: '设备每天平均检查数' },
  { id: 'device_maintenance_count', name: '设备维修次数', dimension: 'device', aggregation: 'count', format: 'number', description: '设备维修总次数' },
  { id: 'appointment_count', name: '预约量', dimension: 'appointment', aggregation: 'count', format: 'number', description: '预约总人次' },
  { id: 'appointment_no_show', name: '爽约量', dimension: 'appointment', aggregation: 'count', format: 'number', description: '爽约总人次' },
  { id: 'appointment_no_show_rate', name: '爽约率', dimension: 'appointment', aggregation: 'avg', format: 'percent', description: '爽约比例' },
  { id: 'avg_wait_time', name: '平均候诊时长', dimension: 'appointment', aggregation: 'avg', format: 'duration', unit: 'min', description: '患者平均候诊时间' },
  { id: 'consultation_count', name: '会诊量', dimension: 'consultation', aggregation: 'count', format: 'number', description: '会诊总次数' },
  { id: 'avg_consultation_time', name: '平均会诊时长', dimension: 'consultation', aggregation: 'avg', format: 'duration', unit: 'min', description: '会诊平均耗时' },
  { id: 'contrast_usage_count', name: '造影剂使用量', dimension: 'contrast', aggregation: 'sum', format: 'number', unit: 'ml', description: '造影剂总用量' },
  { id: 'contrast_reaction_count', name: '造影剂不良反应', dimension: 'contrast', aggregation: 'count', format: 'number', description: '不良反应事件数' },
  { id: 'dose_dlp_avg', name: '平均DLP剂量', dimension: 'dose', aggregation: 'avg', format: 'decimal', unit: 'mGy·cm', description: 'CT平均DLP剂量' },
  { id: 'dose_effective_avg', name: '平均有效剂量', dimension: 'dose', aggregation: 'avg', format: 'decimal', unit: 'mSv', description: '平均有效辐射剂量' },
  { id: 'dose_compliance_rate', name: '剂量合规率', dimension: 'dose', aggregation: 'avg', format: 'percent', description: '辐射剂量达标比例' },
  { id: 'ai_suggestion_count', name: 'AI建议量', dimension: 'ai', aggregation: 'count', format: 'number', description: 'AI辅助诊断建议数' },
  { id: 'ai_acceptance_rate', name: 'AI采纳率', dimension: 'ai', aggregation: 'avg', format: 'percent', description: 'AI建议被医生采纳比例' },
  { id: 'patient_satisfaction', name: '患者满意度', dimension: 'survey', aggregation: 'avg', format: 'decimal', unit: '分', description: '患者满意度平均分' },
  { id: 'positive_rate', name: '阳性检出率', dimension: 'exam', aggregation: 'avg', format: 'percent', description: '阳性发现检出比例' },
  { id: 'emergency_ratio', name: '急诊占比', dimension: 'exam', aggregation: 'avg', format: 'percent', description: '急诊检查占总检查比例' },
  { id: 'inpatient_ratio', name: '住院占比', dimension: 'exam', aggregation: 'avg', format: 'percent', description: '住院检查占总检查比例' },
  { id: 'report_timely_rate', name: '报告及时率', dimension: 'report', aggregation: 'avg', format: 'percent', description: '规定时间内完成报告比例' },
  { id: 'sla_compliance_rate', name: 'SLA达标率', dimension: 'sla', aggregation: 'avg', format: 'percent', description: '服务级别协议达标比例' },
]

export const dimensions: DimensionDefinition[] = [
  {
    id: 'date', name: '日期', type: 'date',
    hierarchies: [[{ name: '年', column: 'year' }, { name: '季度', column: 'quarter' }, { name: '月', column: 'month' }, { name: '日', column: 'day' }]],
    description: '检查日期',
  },
  {
    id: 'modality', name: '检查类型', type: 'categorical',
    description: '设备模态 (CT/MR/DR/MG/DSA)',
  },
  {
    id: 'device', name: '设备', type: 'categorical',
    description: '检查设备名称',
  },
  {
    id: 'doctor', name: '医生', type: 'categorical',
    description: '报告医生/审核医生',
  },
  {
    id: 'department', name: '科室', type: 'categorical',
    description: '申请科室/检查科室',
  },
  {
    id: 'body_part', name: '检查部位', type: 'categorical',
    description: '检查身体部位',
  },
  {
    id: 'age_group', name: '年龄分组', type: 'categorical',
    description: '患者年龄段',
  },
  {
    id: 'gender', name: '性别', type: 'categorical',
    description: '患者性别',
  },
  {
    id: 'patient_type', name: '患者类型', type: 'categorical',
    description: '门诊/住院/急诊/体检',
  },
  {
    id: 'report_state', name: '报告状态', type: 'categorical',
    description: '报告当前状态',
  },
]

export function buildQuery(
  dims: string[],
  measures: string[],
  filters?: OLAPFilter[],
  granularity?: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly',
): OLAPQuery {
  return {
    dimensions: dims,
    measures,
    filters,
    granularity,
  }
}

export async function executeQuery(query: OLAPQuery): Promise<QueryResult> {
  const res = await fetch(`${API_BASE}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(query),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as any).message || `OLAP query failed: ${res.statusText}`)
  }
  return res.json()
}

export async function fetchMetadata(): Promise<MetadataResponse> {
  const res = await fetch(`${API_BASE}/metadata`)
  if (!res.ok) throw new Error(`Failed to fetch metadata: ${res.statusText}`)
  return res.json()
}

export { type OLAPQuery, type OLAPFilter, type QueryResult, type MetadataResponse }
