/**
 * [G005 W9-QC] 规范化缺陷库 (defect-library) 类型 — 分类 (categories) + 缺陷项 (items)
 * 孤儿模块: 内存 + seed, 无 DB 可启动; 供互评/PDCA/质控关联引用。
 */

export type DefectSeverity = 'low' | 'medium' | 'high' | 'critical'

export interface DefectCategory {
  id: string
  code: string
  name: string
  nameEn?: string
  description: string
}

export interface DefectItem {
  id: string
  code: string
  categoryCode: string
  name: string
  nameEn?: string
  severity: DefectSeverity
  description: string
  standard?: string
  checkMethod?: string
}

export interface DefectAggregation {
  total: number
  byCategory: Array<{ categoryCode: string; categoryName: string; count: number }>
  bySeverity: Array<{ severity: DefectSeverity; count: number }>
  byCategorySeverity: Array<{ categoryCode: string; severity: DefectSeverity; count: number }>
}
