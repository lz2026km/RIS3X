/**
 * G005 放射RIS系统 v3.0.6.11-105 Wave 1A - 放射影像专业医疗质量控制指标 (2024 年版) 服务
 *
 * 孤儿模块模式 (orphan module pattern):
 *   - PrismaService 可选注入 (@Optional), 可无 DB 启动;
 *   - 数据从同源表派生: report / exam / critical_value / dicom_instance / audit_log (contrast-safety);
 *     DB 不可用或数据为空时回退确定性 seed (同输入恒同输出);
 *   - 不新增任何 DB 表。
 *
 * 目标值配置为内存持久化 (默认值来自国标口径), 支持 PUT 覆盖。
 */
import { BadRequestException, Injectable, Logger, Optional } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import {
  DEFAULT_INDICATOR_CONFIG,
  INDICATOR_CODES,
  RQI_STANDARD,
  type IndicatorCode,
  type IndicatorConfig,
  type IndicatorDetailResult,
  type IndicatorResult,
  type IndicatorTrendPoint,
  type IndicatorWindow,
  type RqiConfigResult,
  type RqiDashboardResult,
  type RqiExportFormat,
  type RqiExportInput,
  type RqiExportResult,
  type RqiGranularity,
  type RqiSourceDataset,
  type UpdateIndicatorConfigInput,
} from './rqi-2024.types'
import {
  buildIndicatorDetail,
  buildIndicatorTrend,
  computeIndicators,
  dateKey,
  latestDatasetDate,
  monthWindow,
  quarterWindow,
  resolveWindow,
  round,
  shiftWindow,
  yearWindow,
} from './rqi-2024.indicator-engine'

// ================= 请求参数 =================

export interface RqiWindowQuery {
  period?: string
  dateFrom?: string
  dateTo?: string
}

export interface IndicatorsListResult {
  source: 'database' | 'seed'
  period: string
  granularity: RqiGranularity
  dateFrom: string
  dateTo: string
  standard: string
  count: number
  indicators: IndicatorResult[]
}

export interface TrendResult {
  source: 'database' | 'seed'
  code: IndicatorCode
  name: string
  months: number
  points: IndicatorTrendPoint[]
}

// ================= 确定性种子 =================

const SEED_MONTHS: Array<[string, number]> = [
  ['2026-04', 30],
  ['2026-05', 31],
  ['2026-06', 30],
  ['2026-07', 31],
  ['2026-08', 14],
]

const SEED_PATIENTS = ['李明', '张伟', '赵敏', '王芳', '陈杰', '孙丽', '周强', '吴静', '郑磊', '冯娜']
const SEED_CT_PARTS = ['胸部', '腹部', '头颅', '腰椎']
const SEED_MR_PARTS = ['头颅', '前列腺', '膝关节', '腰椎']

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function seedIso(dayStr: string, hour: number, minute = 0): string {
  return `${dayStr}T${pad2(hour)}:${pad2(minute)}:00.000Z`
}

/**
 * 确定性 seed 生成: 固定日期/模态/伪影/外渗/分类模式, 无随机数。
 * 覆盖全部 7 指标且分母均 > 0。
 */
export function buildSeedDataset(): RqiSourceDataset {
  const exams: RqiSourceDataset['exams'] = []
  const reports: RqiSourceDataset['reports'] = []
  const criticalEvents: RqiSourceDataset['criticalEvents'] = []
  let seq = 0

  for (const [month, lastDay] of SEED_MONTHS) {
    for (let day = 1; day <= lastDay; day++) {
      const dayStr = `${month}-${pad2(day)}`
      for (let i = 0; i < 4; i++) {
        seq += 1
        const modality = (['CT', 'MR', 'DR', 'MG'] as const)[i]!
        const patientName = SEED_PATIENTS[(day + i) % SEED_PATIENTS.length]!
        const patientId = `P-${pad2(((day * 7 + i) % 40) + 1)}`
        const accessionNumber = `ACC-${month.replace('-', '')}-${pad2(day)}-${i}`
        const examId = `EX-${seq}`
        const reportId = `RPT-RQI-${seq}`

        let bodyPart = ''
        let isEmergency = false
        let isEnhancedCt = false
        let hasArtifact = false
        let artifactNote: string | undefined
        let contrastExtravasation = false

        if (modality === 'CT') {
          bodyPart = SEED_CT_PARTS[day % SEED_CT_PARTS.length]!
          isEmergency = day % 10 === 0
          isEnhancedCt = day % 2 === 1
          hasArtifact = (day * 7 + 1) % 50 === 0
          artifactNote = hasArtifact ? '呼吸/运动伪影' : undefined
          contrastExtravasation = isEnhancedCt && (day * 13 + 7) % 1000 === 0
        } else if (modality === 'MR') {
          bodyPart = day % 7 === 0 ? '前列腺' : SEED_MR_PARTS[(day + 1) % SEED_MR_PARTS.length]!
          if (bodyPart === '前列腺') isEnhancedCt = false
          hasArtifact = (day * 11 + 3) % 60 === 0
          artifactNote = hasArtifact ? '金属/运动伪影' : undefined
        } else if (modality === 'DR') {
          bodyPart = '胸部'
          isEmergency = true
          hasArtifact = (day * 5 + 2) % 70 === 0
          artifactNote = hasArtifact ? '体位伪影' : undefined
        } else {
          bodyPart = '乳腺'
        }

        const startedAt = seedIso(dayStr, 8 + i, 15)
        const emergencyOutlier = (day * 13 + i * 7) % 40 === 0
        const minutes = isEmergency
          ? emergencyOutlier
            ? 135 + (day % 30)
            : 35 + ((day * 7 + i) % 70)
          : 40 + ((day * 11 + i * 5) % 90)
        const reportIssuedAt = seedIso(dayStr, 8 + i, 15 + minutes)

        exams.push({
          examId,
          accessionNumber,
          patientId,
          patientName,
          modality,
          bodyPart,
          startedAt,
          isEmergency,
          isEnhancedCt,
          hasArtifact,
          artifactNote,
          contrastExtravasation,
          reportId,
        })

        const hasRadiologistSignature = (day * 17 + i) % 60 !== 0
        const conclusionMatchesFindings = (day * 19 + i * 3) % 80 !== 0
        const hasObviousError = (day * 23 + i * 11) % 90 === 0
        let radsCategory = ''
        if (modality === 'MR' && bodyPart === '前列腺') {
          radsCategory = day % 20 !== 0 ? `PI-RADS ${2 + (day % 5)}` : ''
        } else if (modality === 'MG') {
          radsCategory = day % 20 !== 0 ? `BI-RADS ${1 + (day % 6)}` : ''
        }

        reports.push({
          reportId,
          examId,
          patientId,
          patientName,
          modality,
          bodyPart,
          isEmergency,
          examStartedAt: startedAt,
          reportIssuedAt,
          hasRadiologistSignature,
          conclusionMatchesFindings,
          hasObviousError,
          errorNote: hasObviousError ? '检出残留模板文字或患者信息缺失' : undefined,
          radsCategory,
          isProstateMr: modality === 'MR' && bodyPart === '前列腺',
          isMammoTarget: modality === 'MG',
        })
      }

      const diagnosis = day % 10 === 0 ? '慢性支气管炎' : (INDICATOR_CRITICAL_DIAGNOSES_SEED[day % INDICATOR_CRITICAL_DIAGNOSES_SEED.length] ?? '急性肺栓塞')
      const foundAt = seedIso(dayStr, 11, 0)
      const notifyMinutes = day % 30 === 0 ? 15 : 2 + (day % 7)
      const notifiedAt = seedIso(dayStr, 11, notifyMinutes)
      criticalEvents.push({
        id: `CRIT-${month.replace('-', '')}-${pad2(day)}`,
        criticalId: `CV-${seq}`,
        examId: `EX-${seq}`,
        patientId: `P-${pad2((day % 40) + 1)}`,
        patientName: SEED_PATIENTS[day % SEED_PATIENTS.length]!,
        diagnosis,
        foundAt,
        notifiedAt,
        hasTimeRecord: true,
        hasContentRecord: true,
        hasSignerRecord: (day * 7) % 25 !== 0,
      })
    }
  }

  return {
    exams,
    reports,
    criticalEvents,
    generatedAt: '2026-08-14T00:00:00.000Z',
    source: 'seed',
  }
}

/** 种子诊断序列 (与国标 13 类对齐, 由 types 常量复制以避免循环依赖) */
const INDICATOR_CRITICAL_DIAGNOSES_SEED: string[] = [
  '急性肺栓塞',
  '急性主动脉夹层',
  '急性主动脉瘤破裂',
  '心包填塞',
  '大量液气血胸',
  '气管支气管异物',
  '急性脑梗死',
  '急性脑出血',
  '急性硬膜外硬膜下出血',
  '急性蛛网膜下腔出血',
  '脑疝',
  '消化道穿孔',
  '腹腔内脏器破裂出血',
  '绞窄性肠梗阻',
]

// ================= 服务 =================

@Injectable()
export class Rqi2024Service {
  private readonly logger = new Logger(Rqi2024Service.name)
  private readonly seed: RqiSourceDataset
  private configItems: IndicatorConfig[] = DEFAULT_INDICATOR_CONFIG.map((c) => ({ ...c }))
  private configUpdatedAt: string | null = null

  constructor(@Optional() private readonly prisma?: PrismaService) {
    this.seed = buildSeedDataset()
    if (!prisma) this.logger.log('Rqi2024Service: no Prisma injected (orphan mode, seed fallback)')
  }

  // ================= 配置 =================

  getConfig(): RqiConfigResult {
    return {
      source: this.configUpdatedAt ? 'override' : 'default',
      updatedAt: this.configUpdatedAt,
      standard: RQI_STANDARD,
      items: this.configItems.map((c) => ({ ...c })),
    }
  }

  updateConfig(inputs: UpdateIndicatorConfigInput[]): RqiConfigResult {
    if (!Array.isArray(inputs) || inputs.length === 0) {
      throw new BadRequestException('items 不能为空')
    }
    for (const input of inputs) {
      const existing = this.configItems.find((c) => c.code === input.code)
      if (!existing) throw new BadRequestException(`未知指标编码 ${input.code}`)
      existing.target = input.target
      if (input.warnMargin !== undefined) existing.warnMargin = input.warnMargin
      if (input.direction !== undefined) existing.direction = input.direction
    }
    this.configUpdatedAt = new Date().toISOString()
    return this.getConfig()
  }

  // ================= 指标汇总 =================

  async getIndicators(query: RqiWindowQuery = {}): Promise<IndicatorsListResult> {
    const { source, dataset } = await this.loadDataset()
    const window = this.resolveRequestWindow(query, dataset)
    const indicators = computeIndicators(dataset, this.configItems, window)
    return {
      source,
      period: window.label,
      granularity: window.granularity,
      dateFrom: window.dateFrom,
      dateTo: window.dateTo,
      standard: RQI_STANDARD,
      count: indicators.length,
      indicators,
    }
  }

  async getDetail(code: string, query: RqiWindowQuery = {}): Promise<{ source: 'database' | 'seed' } & IndicatorDetailResult> {
    const resolved = assertIndicatorCode(code)
    const { source, dataset } = await this.loadDataset()
    const window = this.resolveRequestWindow(query, dataset)
    return { source, ...buildIndicatorDetail(resolved, dataset, this.configItems, window) }
  }

  async getTrend(code: string, months = 12): Promise<TrendResult> {
    const resolved = assertIndicatorCode(code)
    const clamped = Math.min(60, Math.max(1, Math.floor(Number.isFinite(months) ? months : 12)))
    const { source, dataset } = await this.loadDataset()
    const points = buildIndicatorTrend(resolved, dataset, this.configItems, clamped)
    const name = this.configItems.find((c) => c.code === resolved)?.name ?? resolved
    return { source, code: resolved, name, months: clamped, points }
  }

  async getDashboard(query: RqiWindowQuery = {}): Promise<RqiDashboardResult> {
    const { source, dataset } = await this.loadDataset()
    const window = this.resolveRequestWindow(query, dataset)
    const indicators = computeIndicators(dataset, this.configItems, window)
    const previousIndicators = computeIndicators(dataset, this.configItems, shiftWindow(window, -1))

    const passCount = indicators.filter((i) => i.status === 'pass').length
    const warnCount = indicators.filter((i) => i.status === 'warn').length
    const failCount = indicators.filter((i) => i.status === 'fail').length

    const mom = indicators.map((cur, index) => {
      const prev = previousIndicators[index]!
      const delta = round(cur.rate - prev.rate, 2)
      const trend: 'up' | 'down' | 'flat' = delta > 0.004 ? 'up' : delta < -0.004 ? 'down' : 'flat'
      return { code: cur.code, name: cur.name, current: cur.rate, previous: prev.rate, delta, trend, unit: cur.unit }
    })

    return {
      source,
      generatedAt: new Date().toISOString(),
      period: window.label,
      granularity: window.granularity,
      standard: RQI_STANDARD,
      total: indicators.length,
      passCount,
      warnCount,
      failCount,
      passRate: indicators.length > 0 ? round((passCount / indicators.length) * 100, 1) : 0,
      indicators,
      mom,
    }
  }

  // ================= 导出 =================

  async export(input: RqiExportInput): Promise<RqiExportResult> {
    const format: RqiExportFormat = input.format === 'json' ? 'json' : 'csv'
    const { dataset } = await this.loadDataset()
    const window = this.resolveRequestWindow(input, dataset)
    const indicators = computeIndicators(dataset, this.configItems, window)
    const suffix = window.label.replace(/[^\w-]/g, '_')
    if (format === 'json') {
      return {
        format,
        content: JSON.stringify({ standard: RQI_STANDARD, period: window.label, indicators }, null, 2),
        filename: `rqi-2024-${suffix}.json`,
      }
    }
    const header = ['指标编码', '指标名称', '分子', '分母', '比率', '单位', '目标', '达标状态']
    const lines = [header.join(',')]
    for (const i of indicators) {
      lines.push([i.code, csvCell(i.name), i.numerator, i.denominator, i.rate, i.unit, i.target, statusLabel(i.status)].join(','))
    }
    return { format, content: `\ufeff${lines.join('\n')}`, filename: `rqi-2024-${suffix}.csv` }
  }

  // ================= 内部: 数据集 =================

  private async loadDataset(): Promise<{ source: 'database' | 'seed'; dataset: RqiSourceDataset }> {
    const prisma = this.prisma
    if (!prisma) return { source: 'seed', dataset: this.seed }
    try {
      const rows = await prisma.report.findMany({
        include: { exam: true, patient: true },
        orderBy: { createdAt: 'desc' },
        take: 500,
      })
      if (!rows || rows.length === 0) return { source: 'seed', dataset: this.seed }

      const imagingReportIds = await this.deriveImagingReportIds()
      const extravasationKeys = await this.deriveExtravasationKeys()

      const exams: RqiSourceDataset['exams'] = []
      const reports: RqiSourceDataset['reports'] = []
      for (const r of rows) {
        const text = [r.findings, r.diagnosis, r.impression, r.conclusion, r.htmlContent].join(' ')
        const modality = (r.exam?.modality ?? 'CT').toUpperCase()
        const bodyPart = r.exam?.bodyPart ?? ''
        const examId = r.exam?.id ?? r.examId ?? `exam-${r.id}`
        const patientName = r.patient?.name ?? ''
        const isEmergency = ['STAT', 'URGENT'].includes((r.exam?.priority ?? '').toUpperCase()) || /急诊/.test(text)
        const hasArtifact = /伪影/.test(text)
        const isEnhancedCt = modality === 'CT' && (imagingReportIds.has(r.id) || /增强|CTA|造影|对比剂/.test(text))
        const extravasation = extravasationKeys.has(examId) || extravasationKeys.has(r.patientId)
        const startedAt = (r.exam?.startedAt ?? r.createdAt).toISOString()
        const issuedAt = (r.publishedAt ?? r.signedAt ?? r.createdAt).toISOString()
        const radsCategory = detectRadsCategory(text)

        exams.push({
          examId,
          accessionNumber: r.exam?.accessionNumber ?? examId,
          patientId: r.patientId,
          patientName,
          modality,
          bodyPart,
          startedAt,
          isEmergency,
          isEnhancedCt,
          hasArtifact,
          artifactNote: hasArtifact ? '影像检出伪影描述' : undefined,
          contrastExtravasation: isEnhancedCt && extravasation,
          reportId: r.id,
        })

        reports.push({
          reportId: r.id,
          examId,
          patientId: r.patientId,
          patientName,
          modality,
          bodyPart,
          isEmergency,
          examStartedAt: startedAt,
          reportIssuedAt: issuedAt,
          hasRadiologistSignature: Boolean(r.signedById || r.signedAt),
          conclusionMatchesFindings: Boolean(r.findings && (r.conclusion || r.impression || r.diagnosis)),
          hasObviousError: /XXX|待补充|模板|示例|占位符|患者姓名不符|信息缺失|脏器缺如|方位错误|单位错误/i.test(text),
          errorNote: /XXX|待补充|模板|示例|占位符/.test(text) ? '检出模板残留或明显错误' : undefined,
          radsCategory,
          isProstateMr: modality === 'MR' && bodyPart.includes('前列腺'),
          isMammoTarget: ['MG', 'MAMMO', 'MAMM', '钼靶'].includes(modality),
        })
      }

      let criticalEvents = await this.deriveCriticalEvents()
      if (criticalEvents.length === 0) criticalEvents = this.seed.criticalEvents

      return {
        source: 'database',
        dataset: { exams, reports, criticalEvents, generatedAt: new Date().toISOString(), source: 'database' },
      }
    } catch (err) {
      this.logger.debug(`[Rqi2024] derive dataset failed, seed fallback: ${(err as Error).message}`)
      return { source: 'seed', dataset: this.seed }
    }
  }

  private async deriveImagingReportIds(): Promise<Set<string>> {
    const ids = new Set<string>()
    const prisma = this.prisma
    if (!prisma) return ids
    try {
      const rows = await prisma.dicomInstance.findMany({ where: { modality: 'CT' }, orderBy: { createdAt: 'desc' }, take: 500 })
      for (const row of rows) if (row.reportId) ids.add(row.reportId)
    } catch (err) {
      this.logger.debug(`[Rqi2024] dicomInstance derive skipped: ${(err as Error).message}`)
    }
    return ids
  }

  private async deriveExtravasationKeys(): Promise<Set<string>> {
    const keys = new Set<string>()
    const prisma = this.prisma
    if (!prisma) return keys
    try {
      const rows = await prisma.auditLog.findMany({ where: { resource: 'contrast-safety' }, orderBy: { createdAt: 'desc' }, take: 200 })
      for (const row of rows) {
        const detail = (row.detail ?? {}) as Record<string, unknown>
        const action = String(detail['action'] ?? row.action ?? '').toLowerCase()
        if (detail['extravasation'] === true || action.includes('extravasation') || action.includes('外渗')) {
          if (detail['examId']) keys.add(String(detail['examId']))
          if (detail['patientId']) keys.add(String(detail['patientId']))
        }
      }
    } catch (err) {
      this.logger.debug(`[Rqi2024] contrast derive skipped: ${(err as Error).message}`)
    }
    return keys
  }

  private async deriveCriticalEvents(): Promise<RqiSourceDataset['criticalEvents']> {
    const prisma = this.prisma
    if (!prisma) return []
    try {
      const rows = await prisma.criticalValue.findMany({ orderBy: { createdAt: 'desc' }, take: 200 })
      return rows.map((c) => {
        const notifiedAt = c.voiceCalledAt ?? c.ackedAt ?? c.confirmedAt
        return {
          id: c.id,
          criticalId: c.id,
          examId: c.examId ?? undefined,
          patientId: c.patientId ?? '',
          patientName: '',
          diagnosis: c.description,
          foundAt: c.createdAt.toISOString(),
          notifiedAt: notifiedAt ? notifiedAt.toISOString() : undefined,
          hasTimeRecord: Boolean(notifiedAt),
          hasContentRecord: Boolean(c.description),
          hasSignerRecord: Boolean(c.confirmedSignature || c.notifiedTo),
        }
      })
    } catch (err) {
      this.logger.debug(`[Rqi2024] critical derive failed: ${(err as Error).message}`)
      return []
    }
  }

  // ================= 内部: 窗口解析 =================

  private resolveRequestWindow(query: RqiWindowQuery, dataset: RqiSourceDataset): IndicatorWindow {
    const period = (query.period ?? '').trim()
    const dateFrom = (query.dateFrom ?? '').trim()
    const dateTo = (query.dateTo ?? '').trim()
    if (dateFrom && dateTo) {
      const granularity = isGranularity(period) ? period : 'month'
      return { granularity, label: `${dateKey(dateFrom)}~${dateKey(dateTo)}`, dateFrom: dateKey(dateFrom), dateTo: dateKey(dateTo) }
    }
    if (/^\d{4}-\d{2}$/.test(period)) return monthWindow(period)
    if (/^\d{4}-Q[1-4]$/.test(period)) return quarterWindow(period)
    if (/^\d{4}$/.test(period)) return yearWindow(period)
    const anchor = latestDatasetDate(dataset)
    const granularity = isGranularity(period) ? period : 'month'
    return resolveWindow(granularity, anchor)
  }
}

// ================= 工具 =================

function isGranularity(value: string): value is RqiGranularity {
  return value === 'month' || value === 'quarter' || value === 'year'
}

function assertIndicatorCode(code: string): IndicatorCode {
  const value = (code ?? '').trim().toUpperCase()
  if ((INDICATOR_CODES as readonly string[]).includes(value)) return value as IndicatorCode
  throw new BadRequestException(`未知指标编码 ${code}`)
}

function detectRadsCategory(text: string): string {
  const pi = /PI[\s-]?RADS[\s:：]*([1-5])/i.exec(text)
  if (pi) return `PI-RADS ${pi[1]}`
  const bi = /BI[\s-]?RADS[\s:：]*([1-6])/i.exec(text)
  if (bi) return `BI-RADS ${bi[1]}`
  return ''
}

function csvCell(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function statusLabel(status: IndicatorResult['status']): string {
  return status === 'pass' ? '达标' : status === 'warn' ? '预警' : '不达标'
}
