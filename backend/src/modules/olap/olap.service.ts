import { Injectable, OnModuleInit } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

interface MetricDef {
  id: string; name: string; dimension: string; aggregation: string; format: string; unit?: string; description: string
}
interface DimensionDef {
  id: string; name: string; type: string; description: string
}
interface OLAPFilter {
  dimension: string; operator: string; value: unknown
}
interface OLAPQuery {
  dimensions: string[]; measures: string[]; filters?: OLAPFilter[]
  granularity?: string; orderBy?: { dimension: string; direction: string }[]
  limit?: number; offset?: number
}

const DIMENSION_COLUMN_MAP: Record<string, string> = {
  date: 'e.completed_at',
  modality: 'e.modality',
  device: 'd.name',
  doctor: 'u.full_name',
  department: 'u.department',
  body_part: 'e.body_part',
  age_group: `CASE WHEN EXTRACT(YEAR FROM AGE(p.birth_date)) < 18 THEN '0-17' WHEN EXTRACT(YEAR FROM AGE(p.birth_date)) < 40 THEN '18-39' WHEN EXTRACT(YEAR FROM AGE(p.birth_date)) < 60 THEN '40-59' WHEN EXTRACT(YEAR FROM AGE(p.birth_date)) < 80 THEN '60-79' ELSE '80+' END`,
  gender: 'p.gender',
  patient_type: 'p.type',
  report_state: 'r.state',
}

const MEASURE_SQL_MAP: Record<string, { sql: string; aggregation: string }> = {
  exam_count: { sql: 'COUNT(DISTINCT e.id)', aggregation: 'count' },
  exam_revenue: { sql: 'COALESCE(SUM(i.total_amount), 0)', aggregation: 'sum' },
  exam_cost: { sql: 'COALESCE(SUM(ci.unit_price), 0)', aggregation: 'sum' },
  avg_exam_time: { sql: 'COALESCE(AVG(EXTRACT(EPOCH FROM (e.completed_at - e.started_at)) / 60), 0)', aggregation: 'avg' },
  avg_report_time: { sql: 'COALESCE(AVG(EXTRACT(EPOCH FROM (r.signed_at - r.created_at)) / 60), 0)', aggregation: 'avg' },
  report_count: { sql: 'COUNT(DISTINCT r.id)', aggregation: 'count' },
  report_revision_count: { sql: 'COUNT(DISTINCT rr.id)', aggregation: 'count' },
  quality_score_avg: { sql: 'COALESCE(AVG(rqs.total_score), 0)', aggregation: 'avg' },
  quality_excellent_rate: { sql: 'COALESCE(AVG(CASE WHEN rqs.total_score >= 90 THEN 1 ELSE 0 END) * 100, 0)', aggregation: 'avg' },
  quality_pass_rate: { sql: 'COALESCE(AVG(CASE WHEN rqs.total_score >= 60 THEN 1 ELSE 0 END) * 100, 0)', aggregation: 'avg' },
  critical_count: { sql: 'COUNT(DISTINCT cv.id)', aggregation: 'count' },
  critical_response_time: { sql: 'COALESCE(AVG(EXTRACT(EPOCH FROM (cv.acked_at - cv.created_at)) / 60), 0)', aggregation: 'avg' },
  critical_notification_rate: { sql: 'COALESCE(AVG(CASE WHEN cv.acked_at IS NOT NULL THEN 1 ELSE 0 END) * 100, 0)', aggregation: 'avg' },
  device_usage_rate: { sql: 'COALESCE(AVG(d.today_usage_min::float / 480 * 100), 0)', aggregation: 'avg' },
  device_daily_exams: { sql: 'COALESCE(AVG(d.today_exams), 0)', aggregation: 'avg' },
  device_maintenance_count: { sql: 'COUNT(DISTINCT CASE WHEN d.state = \'MAINTENANCE\' THEN d.id END)', aggregation: 'count' },
  appointment_count: { sql: 'COUNT(DISTINCT a.id)', aggregation: 'count' },
  appointment_no_show: { sql: 'COUNT(DISTINCT CASE WHEN a.state = \'NO_SHOW\' THEN a.id END)', aggregation: 'count' },
  appointment_no_show_rate: { sql: 'COALESCE(COUNT(DISTINCT CASE WHEN a.state = \'NO_SHOW\' THEN a.id END)::float / NULLIF(COUNT(DISTINCT a.id), 0) * 100, 0)', aggregation: 'avg' },
  avg_wait_time: { sql: 'COALESCE(AVG(EXTRACT(EPOCH FROM (e.started_at - a.scheduled_at)) / 60), 0)', aggregation: 'avg' },
  consultation_count: { sql: '0', aggregation: 'count' },
  avg_consultation_time: { sql: '0', aggregation: 'avg' },
  dose_dlp_avg: { sql: '0', aggregation: 'avg' },
  dose_effective_avg: { sql: '0', aggregation: 'avg' },
  dose_compliance_rate: { sql: '100', aggregation: 'avg' },
  ai_suggestion_count: { sql: 'COUNT(DISTINCT ei.id)', aggregation: 'count' },
  ai_acceptance_rate: { sql: 'COALESCE(AVG(CASE WHEN ei.confidence > 0.8 THEN 1 ELSE 0 END) * 100, 0)', aggregation: 'avg' },
  patient_satisfaction: { sql: '0', aggregation: 'avg' },
  positive_rate: { sql: 'COALESCE(AVG(CASE WHEN r.findings != \'\' THEN 1 ELSE 0 END) * 100, 0)', aggregation: 'avg' },
  emergency_ratio: { sql: 'COALESCE(AVG(CASE WHEN p.type = \'EMERGENCY\' THEN 1 ELSE 0 END) * 100, 0)', aggregation: 'avg' },
  inpatient_ratio: { sql: 'COALESCE(AVG(CASE WHEN p.type = \'INPATIENT\' THEN 1 ELSE 0 END) * 100, 0)', aggregation: 'avg' },
  report_timely_rate: { sql: 'COALESCE(AVG(CASE WHEN r.signed_at IS NOT NULL AND r.signed_at <= r.created_at + INTERVAL \'24 hours\' THEN 1 ELSE 0 END) * 100, 0)', aggregation: 'avg' },
  sla_compliance_rate: { sql: '100', aggregation: 'avg' },
}

const METRICS: MetricDef[] = [
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
  { id: 'consultation_count', name: '会诊量', dimension: 'consultation', aggregation: 'count', format: 'number', description: '会诊总次数' },
  { id: 'avg_consultation_time', name: '平均会诊时长', dimension: 'consultation', aggregation: 'avg', format: 'duration', unit: 'min', description: '会诊平均耗时' },
  { id: 'contrast_usage_count', name: '造影剂使用量', dimension: 'contrast', aggregation: 'sum', format: 'number', unit: 'ml', description: '造影剂总用量' },
  { id: 'contrast_reaction_count', name: '造影剂不良反应', dimension: 'contrast', aggregation: 'count', format: 'number', description: '不良反应事件数' },
]

const DIMENSIONS: DimensionDef[] = [
  { id: 'date', name: '日期', type: 'date', description: '检查日期' },
  { id: 'modality', name: '检查类型', type: 'categorical', description: '设备模态 (CT/MR/DR/MG/DSA)' },
  { id: 'device', name: '设备', type: 'categorical', description: '检查设备名称' },
  { id: 'doctor', name: '医生', type: 'categorical', description: '报告医生/审核医生' },
  { id: 'department', name: '科室', type: 'categorical', description: '申请科室/检查科室' },
  { id: 'body_part', name: '检查部位', type: 'categorical', description: '检查身体部位' },
  { id: 'age_group', name: '年龄分组', type: 'categorical', description: '患者年龄段' },
  { id: 'gender', name: '性别', type: 'categorical', description: '患者性别' },
  { id: 'patient_type', name: '患者类型', type: 'categorical', description: '门诊/住院/急诊/体检' },
  { id: 'report_state', name: '报告状态', type: 'categorical', description: '报告当前状态' },
]

interface CacheEntry {
  data: unknown
  expiresAt: number
}

@Injectable()
export class OlapService {
  private cache = new Map<string, CacheEntry>()

  constructor(private readonly prisma: PrismaService) {}

  getMetadata() {
    return { metrics: METRICS, dimensions: DIMENSIONS }
  }

  async executeQuery(query: OLAPQuery) {
    const cacheKey = JSON.stringify(query)
    const cached = this.cache.get(cacheKey)
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data
    }

    const sql = this.buildSQL(query)
    let rows: Record<string, unknown>[]

    try {
      rows = await this.prisma.$queryRawUnsafe(sql) as Record<string, unknown>[]
    } catch {
      rows = []
    }

    const result = {
      columns: [
        ...query.dimensions.map((d) => ({ key: d, name: DIMENSIONS.find((dd) => dd.id === d)?.name || d, type: 'dimension' as const })),
        ...query.measures.map((m) => ({ key: m, name: METRICS.find((mm) => mm.id === m)?.name || m, type: 'measure' as const })),
      ],
      rows,
      total: rows.length,
      query,
      generatedAt: new Date().toISOString(),
    }

    this.cache.set(cacheKey, { data: result, expiresAt: Date.now() + 300_000 })

    return result
  }

  private buildSQL(query: OLAPQuery): string {
    const dimSql = query.dimensions.map((d) => {
      const col = DIMENSION_COLUMN_MAP[d]
      if (!col) return null
      if (d === 'date' && query.granularity) {
        switch (query.granularity) {
          case 'yearly': return `EXTRACT(YEAR FROM ${col}) AS "${d}"`
          case 'quarterly': return `CONCAT(EXTRACT(YEAR FROM ${col}), '-Q', EXTRACT(QUARTER FROM ${col})) AS "${d}"`
          case 'monthly': return `TO_CHAR(${col}, 'YYYY-MM') AS "${d}"`
          case 'weekly': return `TO_CHAR(${col}, 'IYYY-IW') AS "${d}"`
          case 'daily': return `TO_CHAR(${col}, 'YYYY-MM-DD') AS "${d}"`
          default: return `${col} AS "${d}"`
        }
      }
      if (d === 'date') return `TO_CHAR(${col}, 'YYYY-MM-DD') AS "${d}"`
      return `${col} AS "${d}"`
    }).filter(Boolean).join(', ')

    const measureSql = query.measures.map((m) => {
      const def = MEASURE_SQL_MAP[m]
      if (!def) return null
      return `${def.sql} AS "${m}"`
    }).filter(Boolean).join(', ')

    const whereClauses: string[] = ['1=1']
    if (query.filters) {
      for (const f of query.filters) {
        if (f.dimension === 'date' && f.operator === 'between' && Array.isArray(f.value)) {
          whereClauses.push(`${DIMENSION_COLUMN_MAP[f.dimension] || f.dimension} >= '${String(f.value[0])}'`)
          whereClauses.push(`${DIMENSION_COLUMN_MAP[f.dimension] || f.dimension} <= '${String(f.value[1])}'`)
        } else if (f.operator === 'in' && Array.isArray(f.value)) {
          const vals = f.value.map((v) => `'${String(v)}'`).join(',')
          whereClauses.push(`${DIMENSION_COLUMN_MAP[f.dimension] || f.dimension} IN (${vals})`)
        } else {
          const op = f.operator === 'like' ? 'LIKE' : f.operator
          const val = typeof f.value === 'string' ? `'${f.value}'` : String(f.value)
          whereClauses.push(`${DIMENSION_COLUMN_MAP[f.dimension] || f.dimension} ${op} ${val}`)
        }
      }
    }

    const joins = [
      'LEFT JOIN "devices" d ON e.device_id = d.id',
      'LEFT JOIN "users" u ON r.radiologist_id = u.id',
      'LEFT JOIN "patients" p ON e.patient_id = p.id',
      'LEFT JOIN "appointments" a ON e.accession_number = a.id::text',
      'LEFT JOIN "report_quality_scores" rqs ON rqs.report_id = r.id',
      'LEFT JOIN "report_revisions" rr ON rr.report_id = r.id',
      'LEFT JOIN "critical_values" cv ON cv.exam_id = e.id',
      'LEFT JOIN "invoices" i ON i.patient_id = p.id',
      'LEFT JOIN "charge_items" ci ON ci.id = i.id::text',
      'LEFT JOIN "eye_ai_inferences" ei ON ei.study_id = p.id::text',
    ].join('\n')

    const groupBy = query.dimensions.map((d) => {
      const col = DIMENSION_COLUMN_MAP[d]
      if (!col) return null
      if (d === 'date' && query.granularity) {
        switch (query.granularity) {
          case 'yearly': return `EXTRACT(YEAR FROM ${col})`
          case 'quarterly': return `CONCAT(EXTRACT(YEAR FROM ${col}), '-Q', EXTRACT(QUARTER FROM ${col}))`
          case 'monthly': return `TO_CHAR(${col}, 'YYYY-MM')`
          case 'weekly': return `TO_CHAR(${col}, 'IYYY-IW')`
          case 'daily': return `TO_CHAR(${col}, 'YYYY-MM-DD')`
          default: return col
        }
      }
      return col
    }).filter(Boolean).join(', ')

    const orderBy = query.orderBy?.map((o) => {
      const col = DIMENSION_COLUMN_MAP[o.dimension] || `"${o.dimension}"`
      return `${col} ${o.direction.toUpperCase()}`
    }).join(', ') || ''

    const sql = [
      'SELECT',
      dimSql ? `${dimSql},` : '',
      measureSql,
      'FROM "exams" e',
      joins,
      'WHERE', whereClauses.join(' AND '),
      groupBy ? `GROUP BY ${groupBy}` : '',
      orderBy ? `ORDER BY ${orderBy}` : '',
      query.limit ? `LIMIT ${query.limit}` : '',
      query.offset ? `OFFSET ${query.offset}` : '',
    ].filter(Boolean).join(' ')

    return sql
  }
}
