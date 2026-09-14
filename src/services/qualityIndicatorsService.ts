/**
 * G005 放射RIS系统 v3.0.6.11-105 Wave 1C - 质量指标库前端服务层
 *
 * 接线已存在的两份数据文件 (此前零引用):
 *   - src/data/qualityIndicators.ts : 40 条国家规范级质控指标 (结构10/过程18/结果12)
 *   - src/data/qualityStandards.ts  : 图像质量评分标准 / 报告质量标准 14 条 / 检查流程质控点
 *
 * 提供: 全量/分类/检索/按编码查询 + 达标判定 + 质控标准读取。
 * 纯函数, 无副作用, 与后端 /quality-indicators/extended 镜像保持同口径。
 */
import {
  QUALITY_INDICATORS,
  filterIndicatorsByCategory,
  searchQualityIndicators,
} from '../data/qualityIndicators';
import type { QICategory, QualityIndicator } from '../data/qualityIndicators';
import {
  IMAGE_QUALITY_DIMENSIONS,
  REPORT_QUALITY_STANDARDS,
  WORKFLOW_QC_POINTS,
  QUALITY_STANDARDS,
} from '../data/qualityStandards';

/** 指标类别英文键 (API 同口径) */
export type QICategoryKey = 'structure' | 'process' | 'outcome';

const CATEGORY_LABELS: Record<QICategoryKey, QICategory> = {
  structure: '结构',
  process: '过程',
  outcome: '结果',
};

/** 目标值解析结果 */
export interface ParsedTarget {
  direction: 'higher' | 'lower';
  value: number;
  unit: string;
}

/** 达标判定结果 */
export interface TargetEvaluation {
  code: string;
  name: string;
  category: QICategory;
  value: number;
  target: string;
  targetValue: number;
  unit: string;
  direction: 'higher' | 'lower';
  passed: boolean;
  comparison: string;
}

/** 质控标准聚合 */
export interface QualityStandardsBundle {
  imageQualityDimensions: typeof IMAGE_QUALITY_DIMENSIONS;
  reportQualityStandards: typeof REPORT_QUALITY_STANDARDS;
  workflowQcPoints: typeof WORKFLOW_QC_POINTS;
}

/**
 * 解析目标值字符串, 如 "≥98%" / "≤2%" / "100%" / "≤48 小时" / "0 起" / "≤1/万"
 */
export function parseTarget(target: string): ParsedTarget {
  const text = target.trim();
  let direction: 'higher' | 'lower' = 'higher';
  if (text.startsWith('≤') || text.startsWith('<') || text.startsWith('＜')) {
    direction = 'lower';
  } else if (text.startsWith('≥') || text.startsWith('>') || text.startsWith('＞')) {
    direction = 'higher';
  }
  const match = /(-?\d+(?:\.\d+)?)/.exec(text);
  const value = match ? Number(match[1]) : 0;
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
            : '';
  if (unit === '起') direction = 'lower';
  return { direction, value, unit };
}

/** 全量 40 条指标 */
export function getAllIndicators(): QualityIndicator[] {
  return QUALITY_INDICATORS.slice();
}

/** 按类别获取指标 (structure | process | outcome) */
export function getByCategory(category: QICategoryKey): QualityIndicator[] {
  const label = CATEGORY_LABELS[category];
  if (!label) return [];
  return filterIndicatorsByCategory(label).slice();
}

/** 按关键词检索指标 (编码/名称/责任人/公式) */
export function searchIndicators(keyword: string): QualityIndicator[] {
  return searchQualityIndicators(keyword).slice();
}

/** 按编码查询单条指标 */
export function getIndicator(code: string): QualityIndicator | null {
  const found = QUALITY_INDICATORS.find((indicator) => indicator.code === code);
  return found ? { ...found } : null;
}

/** 达标判定 (边界: 等于目标值算达标) */
export function evaluateAgainstTarget(code: string, value: number): TargetEvaluation | null {
  const indicator = getIndicator(code);
  if (!indicator) return null;
  const parsed = parseTarget(indicator.target);
  const passed = parsed.direction === 'higher' ? value >= parsed.value : value <= parsed.value;
  return {
    code: indicator.code,
    name: indicator.name,
    category: indicator.category,
    value,
    target: indicator.target,
    targetValue: parsed.value,
    unit: parsed.unit,
    direction: parsed.direction,
    passed,
    comparison:
      parsed.direction === 'higher'
        ? `实测 ${value} ≥ 目标 ${parsed.value}`
        : `实测 ${value} ≤ 目标 ${parsed.value}`,
  };
}

/** 图像质量评分标准 / 报告质量标准 / 检查流程质控点 */
export function getQualityStandards(): QualityStandardsBundle {
  return {
    imageQualityDimensions: IMAGE_QUALITY_DIMENSIONS,
    reportQualityStandards: REPORT_QUALITY_STANDARDS,
    workflowQcPoints: WORKFLOW_QC_POINTS,
  };
}

/** 原始聚合常量 (与数据文件 QUALITY_STANDARDS 一致) */
export { QUALITY_STANDARDS };

export const qualityIndicatorsService = {
  getAllIndicators,
  getByCategory,
  searchIndicators,
  getIndicator,
  evaluateAgainstTarget,
  getQualityStandards,
  parseTarget,
};

export default qualityIndicatorsService;
