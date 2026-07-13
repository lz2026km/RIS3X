import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'

export interface MetricDef {
  id: string; name: string; dimension: string; aggregation: string; format: string; unit?: string; description: string
}
export interface DimensionDef {
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

interface FilterClause {
  sql: Prisma.Sql
}

const DIMENSION_COLUMN_MAP: Record<string, Prisma.Sql> = {
  date: Prisma.sql`e.completed_at`,
  modality: Prisma.sql`e.modality`,
  device: Prisma.sql`d.name`,
  doctor: Prisma.sql`u.full_name`,
  department: Prisma.sql`u.department`,
  body_part: Prisma.sql`e.body_part`,
  age_group: Prisma.sql`CASE WHEN EXTRACT(YEAR FROM AGE(p.birth_date)) < 18 THEN '0-17' WHEN EXTRACT(YEAR FROM AGE(p.birth_date)) < 40 THEN '18-39' WHEN EXTRACT(YEAR FROM AGE(p.birth_date)) < 60 THEN '40-59' WHEN EXTRACT(YEAR FROM AGE(p.birth_date)) < 80 THEN '60-79' ELSE '80+' END`,
  gender: Prisma.sql`p.gender`,
  patient_type: Prisma.sql`p.type`,
  report_state: Prisma.sql`r.state`,
}

const MEASURE_SQL_MAP: Record<string, Prisma.Sql> = {
  exam_count: Prisma.sql`COUNT(DISTINCT e.id)`,
  exam_revenue: Prisma.sql`COALESCE(SUM(i.total_amount), 0)`,
  exam_cost: Prisma.sql`COALESCE(SUM(ci.unit_price), 0)`,
  avg_exam_time: Prisma.sql`COALESCE(AVG(EXTRACT(EPOCH FROM (e.completed_at - e.started_at)) / 60), 0)`,
  avg_report_time: Prisma.sql`COALESCE(AVG(EXTRACT(EPOCH FROM (r.signed_at - r.created_at)) / 60), 0)`,
  report_count: Prisma.sql`COUNT(DISTINCT r.id)`,
  report_revision_count: Prisma.sql`COUNT(DISTINCT rr.id)`,
  quality_score_avg: Prisma.sql`COALESCE(AVG(rqs.total_score), 0)`,
  quality_excellent_rate: Prisma.sql`COALESCE(AVG(CASE WHEN rqs.total_score >= 90 THEN 1 ELSE 0 END) * 100, 0)`,
  quality_pass_rate: Prisma.sql`COALESCE(AVG(CASE WHEN rqs.total_score >= 60 THEN 1 ELSE 0 END) * 100, 0)`,
  critical_count: Prisma.sql`COUNT(DISTINCT cv.id)`,
  critical_response_time: Prisma.sql`COALESCE(AVG(EXTRACT(EPOCH FROM (cv.acked_at - cv.created_at)) / 60), 0)`,
  critical_notification_rate: Prisma.sql`COALESCE(AVG(CASE WHEN cv.acked_at IS NOT NULL THEN 1 ELSE 0 END) * 100, 0)`,
  device_usage_rate: Prisma.sql`COALESCE(AVG(d.today_usage_min::float / 480 * 100), 0)`,
  device_daily_exams: Prisma.sql`COALESCE(AVG(d.today_exams), 0)`,
  device_maintenance_count: Prisma.sql`COUNT(DISTINCT CASE WHEN d.state = 'MAINTENANCE' THEN d.id END)`,
  appointment_count: Prisma.sql`COUNT(DISTINCT a.id)`,
  appointment_no_show: Prisma.sql`COUNT(DISTINCT CASE WHEN a.state = 'NO_SHOW' THEN a.id END)`,
  appointment_no_show_rate: Prisma.sql`COALESCE(COUNT(DISTINCT CASE WHEN a.state = 'NO_SHOW' THEN a.id END)::float / NULLIF(COUNT(DISTINCT a.id), 0) * 100, 0)`,
  avg_wait_time: Prisma.sql`COALESCE(AVG(EXTRACT(EPOCH FROM (e.started_at - a.scheduled_at)) / 60), 0)`,
  consultation_count: Prisma.sql`COALESCE((SELECT (value->>'count')::numeric FROM system_config WHERE key = 'kpi.consultation_count'), 0)`,
  avg_consultation_time: Prisma.sql`COALESCE((SELECT (value->>'avg_minutes')::numeric FROM system_config WHERE key = 'kpi.avg_consultation_time'), 0)`,
  dose_dlp_avg: Prisma.sql`COALESCE((SELECT (value->>'dlp_avg')::numeric FROM system_config WHERE key = 'kpi.dose_dlp_avg'), 0)`,
  dose_effective_avg: Prisma.sql`COALESCE((SELECT (value->>'effective_avg')::numeric FROM system_config WHERE key = 'kpi.dose_effective_avg'), 0)`,
  dose_compliance_rate: Prisma.sql`COALESCE((SELECT (value->>'compliance_pct')::numeric FROM system_config WHERE key = 'kpi.dose_compliance_rate'), 100)`,
  ai_suggestion_count: Prisma.sql`COUNT(DISTINCT ei.id)`,
  ai_acceptance_rate: Prisma.sql`COALESCE(AVG(CASE WHEN ei.confidence > 0.8 THEN 1 ELSE 0 END) * 100, 0)`,
  patient_satisfaction: Prisma.sql`COALESCE((SELECT (value->>'score')::numeric FROM system_config WHERE key = 'kpi.patient_satisfaction'), 0)`,
  positive_rate: Prisma.sql`COALESCE(AVG(CASE WHEN r.findings != '' THEN 1 ELSE 0 END) * 100, 0)`,
  emergency_ratio: Prisma.sql`COALESCE(AVG(CASE WHEN p.type = 'EMERGENCY' THEN 1 ELSE 0 END) * 100, 0)`,
  inpatient_ratio: Prisma.sql`COALESCE(AVG(CASE WHEN p.type = 'INPATIENT' THEN 1 ELSE 0 END) * 100, 0)`,
  report_timely_rate: Prisma.sql`COALESCE(AVG(CASE WHEN r.signed_at IS NOT NULL AND r.signed_at <= r.created_at + INTERVAL '24 hours' THEN 1 ELSE 0 END) * 100, 0)`,
  sla_compliance_rate: Prisma.sql`COALESCE((SELECT (value->>'sla_pct')::numeric FROM system_config WHERE key = 'kpi.sla_compliance_rate'), 100)`,
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

    let rows: Record<string, unknown>[] = []
    try {
      rows = (await this.prisma.$queryRaw(this.buildSQL(query))) as Record<string, unknown>[]
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

  private dimExpression(d: string, granularity?: string): Prisma.Sql | null {
    const col = DIMENSION_COLUMN_MAP[d]
    if (!col) return null
    if (d === 'date' && granularity) {
      switch (granularity) {
        case 'yearly': return Prisma.sql`EXTRACT(YEAR FROM ${col})`
        case 'quarterly': return Prisma.sql`CONCAT(EXTRACT(YEAR FROM ${col}), '-Q', EXTRACT(QUARTER FROM ${col}))`
        case 'monthly': return Prisma.sql`TO_CHAR(${col}, 'YYYY-MM')`
        case 'weekly': return Prisma.sql`TO_CHAR(${col}, 'IYYY-IW')`
        case 'daily': return Prisma.sql`TO_CHAR(${col}, 'YYYY-MM-DD')`
        default: return col
      }
    }
    if (d === 'date') return Prisma.sql`TO_CHAR(${col}, 'YYYY-MM-DD')`
    return col
  }

  private readonly ALLOWED_OPS = new Set(['=', '<', '<=', '>', '>=', 'eq', 'ne', 'lt', 'lte', 'gt', 'gte', 'in', 'like', 'between'])

  private buildFilter(f: OLAPFilter): Prisma.Sql | null {
    if (!this.ALLOWED_OPS.has(f.operator)) return null

    const col = DIMENSION_COLUMN_MAP[f.dimension]
    if (!col) return null

    if (f.dimension === 'date' && f.operator === 'between' && Array.isArray(f.value)) {
      const v0 = String(f.value[0] ?? '')
      const v1 = String(f.value[1] ?? '')
      return Prisma.sql`${col} >= ${v0}::timestamp AND ${col} <= ${v1}::timestamp`
    }
    if (f.operator === 'in' && Array.isArray(f.value)) {
      if (f.value.length === 0) return null
      const placeholders = f.value.map((v) => Prisma.sql`${String(v)}`)
      return Prisma.sql`${col} IN (${Prisma.join(placeholders)})`
    }
    if (f.operator === 'like') {
      const v = typeof f.value === 'string' ? `%${f.value}%` : String(f.value)
      return Prisma.sql`${col} LIKE ${v}`
    }
    if (['<', '<=', '>', '>=', '='].includes(f.operator)) {
      const op = f.operator
      const v = typeof f.value === 'string' ? f.value : Number(f.value)
      return Prisma.sql`${col} ${Prisma.raw(op)} ${v}`
    }
    const op = f.operator === 'eq' ? '=' : f.operator === 'ne' ? '<>' : f.operator === 'lt' ? '<' : f.operator === 'lte' ? '<=' : f.operator === 'gt' ? '>' : f.operator === 'gte' ? '>=' : '='
    const v = typeof f.value === 'string' ? f.value : String(f.value)
    return Prisma.sql`${col} ${Prisma.raw(op)} ${v}`
  }

  private buildSQL(query: OLAPQuery): Prisma.Sql {
    const dimSelects: Prisma.Sql[] = []
    for (const d of query.dimensions) {
      if (!DIMENSION_COLUMN_MAP[d]) continue
      const expr = this.dimExpression(d, query.granularity)
      if (expr) {
        dimSelects.push(Prisma.sql`${expr} AS ${Prisma.raw(`"${d}"`)}`)
      }
    }
    const dimSelectClause = dimSelects.length > 0
      ? Prisma.sql`${Prisma.join(dimSelects, ', ')},`
      : Prisma.empty

    const measureSelects: Prisma.Sql[] = []
    for (const m of query.measures) {
      const def = MEASURE_SQL_MAP[m]
      if (def && Object.prototype.hasOwnProperty.call(MEASURE_SQL_MAP, m)) {
        measureSelects.push(Prisma.sql`${def} AS ${Prisma.raw(`"${m}"`)}`)
      }
    }
    const measureSelectClause = measureSelects.length > 0
      ? Prisma.join(measureSelects, ', ')
      : Prisma.sql`NULL`

    const whereParts: Prisma.Sql[] = [Prisma.sql`1=1`]
    if (query.filters) {
      for (const f of query.filters) {
        const clause = this.buildFilter(f)
        if (clause) whereParts.push(clause)
      }
    }
    const whereClause = Prisma.join(whereParts, ' AND ')

    const joins = Prisma.sql`
      LEFT JOIN "devices" d ON e.device_id = d.id
      LEFT JOIN "users" u ON r.radiologist_id = u.id
      LEFT JOIN "patients" p ON e.patient_id = p.id
      LEFT JOIN "appointments" a ON e.accession_number = a.id::text
      LEFT JOIN "report_quality_scores" rqs ON rqs.report_id = r.id
      LEFT JOIN "report_revisions" rr ON rr.report_id = r.id
      LEFT JOIN "critical_values" cv ON cv.exam_id = e.id
      LEFT JOIN "invoices" i ON i.patient_id = p.id
      LEFT JOIN "charge_items" ci ON ci.id = i.id::text
      LEFT JOIN "eye_ai_inferences" ei ON ei.study_id = p.id::text
    `

    let groupByClause: Prisma.Sql = Prisma.empty
    if (dimSelects.length > 0) {
      const groupExprs: Prisma.Sql[] = []
      for (const d of query.dimensions) {
        const expr = this.dimExpression(d, query.granularity)
        if (expr) groupExprs.push(expr)
      }
      groupByClause = Prisma.sql`GROUP BY ${Prisma.join(groupExprs, ', ')}`
    }

    let orderByClause: Prisma.Sql = Prisma.empty
    if (query.orderBy && query.orderBy.length > 0) {
      const parts: Prisma.Sql[] = []
      for (const o of query.orderBy) {
        const dir = o.direction.toUpperCase() === 'DESC' ? 'DESC' : 'ASC'
        const col = DIMENSION_COLUMN_MAP[o.dimension]
        if (!col) continue
        parts.push(Prisma.sql`${col} ${Prisma.raw(dir)}`)
      }
      orderByClause = Prisma.sql`ORDER BY ${Prisma.join(parts, ', ')}`
    }

    const limitClause = query.limit ? Prisma.sql`LIMIT ${query.limit}` : Prisma.empty
    const offsetClause = query.offset ? Prisma.sql`OFFSET ${query.offset}` : Prisma.empty

    return Prisma.sql`
      SELECT ${dimSelectClause} ${measureSelectClause}
      FROM "exams" e
      ${joins}
      WHERE ${whereClause}
      ${groupByClause}
      ${orderByClause}
      ${limitClause}
      ${offsetClause}
    `
  }
}
