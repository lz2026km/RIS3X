/**
 * G005 放射RIS系统 v3.0.6.11-105 Wave 1C - 质量指标库 zod 校验 (中英双语描述)
 *   - 指标列表查询 (类别 / 关键词)
 *   - 指标编码查询
 *   - 达标判定 (编码 + 实测值)
 */
import { z } from 'zod'

/** 指标类别查询 / Indicator category query */
export const IndicatorCategorySchema = z.enum(['structure', 'process', 'outcome']).describe('指标类别 / Indicator category: structure | process | outcome')

/** 指标列表查询参数 / Indicator list query */
export const ListIndicatorsSchema = z
  .object({
    category: IndicatorCategorySchema.optional(),
    keyword: z.string().max(60).optional().describe('关键词 (编码/名称/责任人/公式) / Search keyword'),
  })
  .describe('质量指标列表查询 / Quality indicator list query')

/** 指标编码参数 / Indicator code param */
export const IndicatorCodeSchema = z
  .string()
  .regex(/^QI-[SPR]\d{2}$/, '编码格式应为 QI-S/P/R + 两位数字')
  .describe('指标编码, 如 QI-P08 / Indicator code (QI-XXX)')

/** 达标判定查询参数 / Target evaluation query */
export const EvaluateTargetSchema = z
  .object({
    code: IndicatorCodeSchema,
    value: z.coerce.number().describe('实测值 (百分比/比值/小时等, 与目标值同口径) / Measured value'),
  })
  .describe('指标达标判定 / Indicator target evaluation')
