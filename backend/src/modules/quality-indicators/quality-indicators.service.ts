/**
 * G005 放射RIS系统 v3.0.6.11-105 Wave 1C - 质量指标库镜像服务 (孤儿模块, 无 DB 可启动)
 *
 * 前端 src/data 数据文件的后端只读镜像, 保证 API 与前端一致:
 *   - 40 条质控指标 (结构 10 / 过程 18 / 结果 12)
 *   - 图像质量评分标准 / 报告质量标准 14 条 / 检查流程质控点
 * 所有计算为纯函数, 同输入恒同输出。
 */
import { BadRequestException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { IMAGE_QUALITY_DIMENSIONS, QUALITY_INDICATORS, REPORT_QUALITY_STANDARDS, WORKFLOW_QC_POINTS } from './quality-indicators.data'
import type {
  ComputedDashboard,
  ComputedSnapshot,
  IndicatorCategoryStat,
  IndicatorEvaluation,
  IndicatorListResult,
  QICategoryKey,
  QualityIndicator,
  QualityStandardsResult,
  QiSourceDataset,
} from './quality-indicators.types'
import { QI_CATEGORY_KEYS, QI_CATEGORY_LABELS } from './quality-indicators.types'
import { aggregateCategories, buildQiSeedDataset, computeQiIndicators, resolveQiWindow } from './quality-indicators.engine'

const COMPUTE_STANDARD = '国卫办医政函〔2024〕150号 附件4（40 项质控指标计算引擎）'

/** 目标值解析结果 */
interface ParsedTarget {
  direction: 'higher' | 'lower'
  value: number
  unit: string
}

/** 解析目标值字符串 (如 "≥98%" / "≤2%" / "100%" / "≤48 小时" / "0 起" / "≤1/万") */
function parseTarget(target: string): ParsedTarget {
  const text = target.trim()
  let direction: 'higher' | 'lower' = 'higher'
  if (text.startsWith('≤') || text.startsWith('<') || text.startsWith('＜')) {
    direction = 'lower'
  } else if (text.startsWith('≥') || text.startsWith('>') || text.startsWith('＞')) {
    direction = 'higher'
  }
  const match = /(-?\d+(?:\.\d+)?)/.exec(text)
  const value = match ? Number(match[1]) : 0
  const unit = text.includes('‰')
    ? '‰'
    : text.includes('%')
      ? '%'
      : text.includes('小时')
        ? '小时'
        : text.includes('/万')
          ? '/万'
          : text.includes('起')
            ? '起'
            : ''
  // "0 起" 等绝对计数目标: 越低越好
  if (unit === '起') direction = 'lower'
  return { direction, value, unit }
}

@Injectable()
export class QualityIndicatorsService {
  private readonly logger = new Logger(QualityIndicatorsService.name)
  private readonly seedDataset: QiSourceDataset = buildQiSeedDataset()
  private snapshots: ComputedSnapshot[] = []
  private snapshotSeq = 0

  constructor(@Optional() private readonly prisma?: PrismaService) {
    if (!prisma) this.logger.log('QualityIndicatorsService: no Prisma injected (orphan mode, seed dataset)')
  }

  /** 40 条指标 (可按类别/关键词过滤) */
  listIndicators(category?: QICategoryKey, keyword?: string): IndicatorListResult {
    const byCategory = QI_CATEGORY_KEYS.reduce(
      (acc, key) => {
        acc[key] = QUALITY_INDICATORS.filter((i) => i.categoryKey === key).length
        return acc
      },
      {} as Record<QICategoryKey, number>,
    )
    const categoryStats: IndicatorCategoryStat[] = QI_CATEGORY_KEYS.map((key) => ({
      category: QI_CATEGORY_LABELS[key],
      categoryKey: key,
      count: byCategory[key],
    }))

    let data = QUALITY_INDICATORS.map((i) => ({ ...i }))
    if (category) data = data.filter((i) => i.categoryKey === category)
    if (keyword && keyword.trim()) {
      const kw = keyword.trim().toLowerCase()
      data = data.filter(
        (i) =>
          i.code.toLowerCase().includes(kw) ||
          i.name.toLowerCase().includes(kw) ||
          i.responsible.toLowerCase().includes(kw) ||
          i.formula.toLowerCase().includes(kw),
      )
    }
    return {
      source: 'mirror',
      generatedAt: new Date().toISOString(),
      total: QUALITY_INDICATORS.length,
      byCategory,
      categoryStats,
      data,
    }
  }

  /** 按编码查询单条指标 */
  getIndicator(code: string): QualityIndicator {
    const found = QUALITY_INDICATORS.find((i) => i.code === code)
    if (!found) throw new NotFoundException(`质量指标 ${code} 不存在`)
    return { ...found }
  }

  /** 达标判定 (边界: 等于目标值算达标) */
  evaluateTarget(code: string, value: number): IndicatorEvaluation {
    if (!Number.isFinite(value)) throw new BadRequestException('实测值必须为有效数值')
    const indicator = this.getIndicator(code)
    const parsed = parseTarget(indicator.target)
    const passed = parsed.direction === 'higher' ? value >= parsed.value : value <= parsed.value
    return {
      code: indicator.code,
      name: indicator.name,
      value,
      target: indicator.target,
      targetValue: parsed.value,
      unit: parsed.unit,
      direction: parsed.direction,
      passed,
      comparison: parsed.direction === 'higher' ? `实测 ${value} ≥ 目标 ${parsed.value}` : `实测 ${value} ≤ 目标 ${parsed.value}`,
    }
  }

  /** 图像/报告/流程质控标准 */
  getStandards(): QualityStandardsResult {
    return {
      source: 'mirror',
      generatedAt: new Date().toISOString(),
      imageDimensionCount: IMAGE_QUALITY_DIMENSIONS.length,
      reportStandardCount: REPORT_QUALITY_STANDARDS.length,
      workflowPointCount: WORKFLOW_QC_POINTS.length,
      imageQualityDimensions: IMAGE_QUALITY_DIMENSIONS.map((d) => ({ ...d, levels: d.levels.map((l) => ({ ...l })) })),
      reportQualityStandards: REPORT_QUALITY_STANDARDS.map((r) => ({ ...r, checkpoints: [...r.checkpoints] })),
      workflowQcPoints: WORKFLOW_QC_POINTS.map((p) => ({ ...p })),
    }
  }

  // ================= 2024 国标 40 指标计算引擎 =================

  /** 加载同源数据集: 报告/检查/危急值/设备; DB 不可用或空 → seed */
  private async loadDataset(): Promise<{ source: 'database' | 'seed'; dataset: QiSourceDataset }> {
    const prisma = this.prisma
    if (!prisma) return { source: 'seed', dataset: this.seedDataset }
    try {
      const reports = await prisma.report.findMany({ include: { exam: true }, orderBy: { createdAt: 'desc' }, take: 500 })
      if (!reports || reports.length === 0) return { source: 'seed', dataset: this.seedDataset }
      const dataset: QiSourceDataset = {
        reports: reports.map((r) => {
          const text = [r.findings, r.diagnosis, r.impression, r.conclusion].join(' ')
          const modality = (r.exam?.modality ?? 'CT').toUpperCase()
          const startedAt = (r.exam?.startedAt ?? r.createdAt).toISOString()
          const issuedAt = (r.publishedAt ?? r.signedAt ?? r.createdAt).toISOString()
          const isEmergency = ['STAT', 'URGENT'].includes((r.exam?.priority ?? '').toUpperCase()) || /急诊/.test(text)
          return {
            id: r.id,
            modality,
            bodyPart: r.exam?.bodyPart ?? '',
            isEmergency,
            examStartedAt: startedAt,
            reportIssuedAt: issuedAt,
            hasSignature: Boolean(r.signedById || r.signedAt),
            conclusionMatches: Boolean(r.findings && (r.conclusion || r.impression || r.diagnosis)),
            hasError: /XXX|待补充|模板|示例|占位符/i.test(text),
            radsCategory: /PI[\s-]?RADS/i.test(text) ? 'PI-RADS' : /BI[\s-]?RADS/i.test(text) ? 'BI-RADS' : '',
            isEnhanced: modality === 'CT' && /增强|造影|对比剂/.test(text),
            extravasation: /外渗/.test(text),
            isProstateMr: modality === 'MR' && (r.exam?.bodyPart ?? '').includes('前列腺'),
            isMammo: ['MG', 'MAMMO', 'MAMM'].includes(modality),
            submittedAt: issuedAt,
            reviewedAt: issuedAt,
            qualityScore: r.qualityScore ?? 90,
          }
        }),
        exams: reports.map((r) => {
          const text = [r.findings, r.diagnosis, r.impression].join(' ')
          return {
            id: r.exam?.id ?? `exam-${r.id}`,
            modality: (r.exam?.modality ?? 'CT').toUpperCase(),
            bodyPart: r.exam?.bodyPart ?? '',
            startedAt: (r.exam?.startedAt ?? r.createdAt).toISOString(),
            hasArtifact: /伪影/.test(text),
            doseRecorded: !/CT/i.test(r.exam?.modality ?? '') || /DLP|CTDI/.test(text),
          }
        }),
        criticals: await this.loadCriticals(),
        devices: await this.loadDevices(),
        generatedAt: new Date().toISOString(),
        source: 'database',
      }
      return { source: 'database', dataset }
    } catch (err) {
      this.logger.debug(`[QualityIndicators] dataset derive failed, seed fallback: ${(err as Error).message}`)
      return { source: 'seed', dataset: this.seedDataset }
    }
  }

  private async loadCriticals(): Promise<QiSourceDataset['criticals']> {
    const prisma = this.prisma
    if (!prisma) return []
    try {
      const rows = await prisma.criticalValue.findMany({ orderBy: { createdAt: 'desc' }, take: 200 })
      return rows.map((c) => {
        const notifiedAt = c.voiceCalledAt ?? c.ackedAt ?? c.confirmedAt
        return {
          id: c.id,
          foundAt: c.createdAt.toISOString(),
          notifiedAt: notifiedAt ? notifiedAt.toISOString() : undefined,
          hasCompleteRecord: Boolean(c.confirmedSignature || c.notifiedTo),
        }
      })
    } catch {
      return []
    }
  }

  private async loadDevices(): Promise<QiSourceDataset['devices']> {
    const prisma = this.prisma
    if (!prisma) return []
    try {
      const rows = await prisma.device.findMany({ take: 100 })
      return rows.map((d) => ({ id: d.id, modality: d.modality, inService: true, todayExams: d.todayExams }))
    } catch {
      return []
    }
  }

  /** GET /quality-indicators/compute — 40 指标实时计算 + 持久化快照 */
  async compute(period?: string, persist = true): Promise<{ source: 'database' | 'seed'; snapshot: ComputedSnapshot }> {
    const { source, dataset } = await this.loadDataset()
    const window = resolveQiWindow(dataset, period)
    const indicators = computeQiIndicators(dataset, QUALITY_INDICATORS, window)
    this.snapshotSeq += 1
    const snapshot: ComputedSnapshot = {
      id: `QIS-${this.snapshotSeq}`,
      generatedAt: new Date().toISOString(),
      period: window.label,
      dateFrom: window.dateFrom,
      dateTo: window.dateTo,
      indicatorCount: indicators.length,
      indicators,
      persisted: true,
    }
    if (persist) {
      this.snapshots.unshift(snapshot)
      if (this.snapshots.length > 50) this.snapshots = this.snapshots.slice(0, 50)
    }
    return { source, snapshot }
  }

  listSnapshots(): ComputedSnapshot[] {
    return this.snapshots.map((s) => ({ ...s, indicators: s.indicators.map((i) => ({ ...i })) }))
  }

  /** GET /quality-indicators/dashboard — 计算引擎聚合 */
  async computeDashboard(period?: string): Promise<ComputedDashboard> {
    const { source, snapshot } = await this.compute(period, false)
    const indicators = snapshot.indicators
    const passCount = indicators.filter((i) => i.status === 'pass').length
    const warnCount = indicators.filter((i) => i.status === 'warn').length
    const failCount = indicators.filter((i) => i.status === 'fail').length
    const nodataCount = indicators.filter((i) => i.status === 'nodata').length
    const denom = indicators.length - nodataCount
    return {
      source,
      generatedAt: snapshot.generatedAt,
      period: snapshot.period,
      standard: COMPUTE_STANDARD,
      total: indicators.length,
      computableCount: indicators.filter((i) => i.computable).length,
      passCount,
      warnCount,
      failCount,
      nodataCount,
      passRate: denom > 0 ? Math.round((passCount / denom) * 1000) / 10 : 0,
      byCategory: aggregateCategories(indicators),
      indicators,
    }
  }
}
