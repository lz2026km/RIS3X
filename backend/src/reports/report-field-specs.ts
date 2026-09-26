// [G005 W8-Report] 结构化报告字段规范 + 参考范围 (seed) + 提交校验。
// 供 GET /reports/field-specs 与提交时的字段校验使用。
import { BadRequestException } from '@nestjs/common'

export type FieldSpecType = 'text' | 'number' | 'enum'

export interface ReportFieldSpec {
  field: string
  label: string
  labelEn: string
  type: FieldSpecType
  required: boolean
  unit?: string
  minLength?: number
  maxLength?: number
  min?: number
  max?: number
  normalRange?: { min?: number; max?: number; unit: string; reference: string }
  allowedValues?: string[]
  description: string
}

export const REPORT_FIELD_SPECS: ReportFieldSpec[] = [
  { field: 'findings', label: '影像所见', labelEn: 'Findings', type: 'text', required: true, minLength: 10, maxLength: 20000, description: '报告主体描述, 需包含部位/形态/密度/边缘等要素' },
  { field: 'conclusion', label: '诊断结论', labelEn: 'Conclusion', type: 'text', required: true, minLength: 2, maxLength: 10000, description: '明确诊断意见, 与所见一致' },
  { field: 'impression', label: '印象', labelEn: 'Impression', type: 'text', required: false, maxLength: 10000, description: '诊断印象 (可与结论合并)' },
  { field: 'diagnosis', label: '诊断', labelEn: 'Diagnosis', type: 'text', required: false, maxLength: 10000, description: '结构化诊断编码对应文本' },
  { field: 'recommendations', label: '建议', labelEn: 'Recommendations', type: 'text', required: false, maxLength: 10000, description: '随访/进一步检查建议' },
  { field: 'noduleSizeMm', label: '结节长径', labelEn: 'Nodule diameter', type: 'number', required: false, unit: 'mm', min: 0, max: 400, normalRange: { max: 8, unit: 'mm', reference: 'Lung-RADS: <8mm 建议随访; ≥8mm 需进一步评估' }, description: '结节最大径' },
  { field: 'ctValueHU', label: 'CT 值', labelEn: 'CT attenuation', type: 'number', required: false, unit: 'HU', min: -1100, max: 3100, normalRange: { min: -1000, max: 3000, unit: 'HU', reference: '常规组织密度 -1000 ~ +3000 HU' }, description: '病灶 CT 密度值' },
  { field: 'breastDensity', label: '乳腺密度', labelEn: 'Breast density', type: 'enum', required: false, allowedValues: ['A', 'B', 'C', 'D'], description: 'ACR 乳腺密度分级 A/B/C/D' },
  { field: 'radsCategory', label: 'RADS 分级', labelEn: 'RADS category', type: 'number', required: false, min: 0, max: 5, normalRange: { max: 2, unit: '级', reference: '3 类及以上需随访/审核加严' }, description: 'RADS 0-5' },
  { field: 'qualityScore', label: '质控评分', labelEn: 'Quality score', type: 'number', required: false, min: 0, max: 100, normalRange: { min: 60, unit: '分', reference: '≥60 合格' }, description: '报告质控得分' },
]

export interface FieldValidationIssue {
  field: string
  label: string
  severity: 'error' | 'warning'
  message: string
}

export interface FieldValidationResult {
  valid: boolean
  errors: FieldValidationIssue[]
  warnings: FieldValidationIssue[]
}

/**
 * 校验结构化字段值 (提交时调用)。
 * @param values 字段键值 (可含 findings/conclusion/.../noduleSizeMm/radsCategory 等)
 */
export function validateReportFields(values: Record<string, unknown>): FieldValidationResult {
  const errors: FieldValidationIssue[] = []
  const warnings: FieldValidationIssue[] = []
  for (const spec of REPORT_FIELD_SPECS) {
    const raw = values[spec.field]
    const present = raw !== undefined && raw !== null && String(raw).trim() !== ''
    if (spec.required && !present) {
      errors.push({ field: spec.field, label: spec.label, severity: 'error', message: `${spec.label} 为必填项` })
      continue
    }
    if (!present) continue
    if (spec.type === 'text') {
      const len = String(raw).trim().length
      if (spec.minLength !== undefined && len < spec.minLength) {
        warnings.push({ field: spec.field, label: spec.label, severity: 'warning', message: `${spec.label} 过短 (${len} < ${spec.minLength})` })
      }
      if (spec.maxLength !== undefined && len > spec.maxLength) {
        errors.push({ field: spec.field, label: spec.label, severity: 'error', message: `${spec.label} 超长 (${len} > ${spec.maxLength})` })
      }
    } else if (spec.type === 'number') {
      const n = Number(raw)
      if (!Number.isFinite(n)) {
        errors.push({ field: spec.field, label: spec.label, severity: 'error', message: `${spec.label} 必须为数值` })
        continue
      }
      if (spec.min !== undefined && n < spec.min) errors.push({ field: spec.field, label: spec.label, severity: 'error', message: `${spec.label} 小于下限 ${spec.min}${spec.unit ?? ''}` })
      if (spec.max !== undefined && n > spec.max) errors.push({ field: spec.field, label: spec.label, severity: 'error', message: `${spec.label} 超过上限 ${spec.max}${spec.unit ?? ''}` })
      const range = spec.normalRange
      if (range && ((range.min !== undefined && n < range.min) || (range.max !== undefined && n > range.max))) {
        warnings.push({ field: spec.field, label: spec.label, severity: 'warning', message: `${spec.label}=${n}${spec.unit ?? ''} 超出参考范围 (${range.reference})` })
      }
    } else if (spec.type === 'enum') {
      if (spec.allowedValues && !spec.allowedValues.includes(String(raw))) {
        errors.push({ field: spec.field, label: spec.label, severity: 'error', message: `${spec.label} 仅允许 ${spec.allowedValues.join('|')}` })
      }
    }
  }
  return { valid: errors.length === 0, errors, warnings }
}

/** 提交校验: 不合法抛 BadRequest (message 汇总) */
export function assertReportFieldsValid(values: Record<string, unknown>): FieldValidationResult {
  const result = validateReportFields(values)
  if (!result.valid) {
    throw new BadRequestException(`字段校验失败: ${result.errors.map((e) => e.message).join('; ')}`)
  }
  return result
}
