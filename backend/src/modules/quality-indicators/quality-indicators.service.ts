/**
 * G005 放射RIS系统 v3.0.6.11-105 Wave 1C - 质量指标库镜像服务 (孤儿模块, 无 DB 可启动)
 *
 * 前端 src/data 数据文件的后端只读镜像, 保证 API 与前端一致:
 *   - 40 条质控指标 (结构 10 / 过程 18 / 结果 12)
 *   - 图像质量评分标准 / 报告质量标准 14 条 / 检查流程质控点
 * 所有计算为纯函数, 同输入恒同输出。
 */
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { IMAGE_QUALITY_DIMENSIONS, QUALITY_INDICATORS, REPORT_QUALITY_STANDARDS, WORKFLOW_QC_POINTS } from './quality-indicators.data'
import type {
  IndicatorCategoryStat,
  IndicatorEvaluation,
  IndicatorListResult,
  QICategoryKey,
  QualityIndicator,
  QualityStandardsResult,
} from './quality-indicators.types'
import { QI_CATEGORY_KEYS, QI_CATEGORY_LABELS } from './quality-indicators.types'

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
}
