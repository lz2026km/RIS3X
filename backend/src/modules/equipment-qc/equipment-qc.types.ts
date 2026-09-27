/**
 * [G005 W9-QC] 设备质控 (equipment-qc) 类型定义 — 模态 CT/DR/MRI/MG 的日常/周/月模体检测
 * 孤儿模块: 无 DB, 内存 + seed, 确定性。
 */

export type EquipmentModality = 'CT' | 'DR' | 'MRI' | 'MG'
export type QcFrequency = 'daily' | 'weekly' | 'monthly'

export interface ThresholdRule {
  /** lte: value ≤ limit; gte: value ≥ limit; range: limit ≤ value ≤ limit2 */
  op: 'lte' | 'gte' | 'range'
  limit: number
  limit2?: number
  unit: string
}

export interface PhantomTestItem {
  id: string
  modality: EquipmentModality
  frequency: QcFrequency
  name: string
  nameEn?: string
  standard: string
  threshold: ThresholdRule
  method: string
}

export interface EquipmentQcRecord {
  id: string
  deviceId: string
  deviceName: string
  modality: EquipmentModality
  frequency: QcFrequency
  testItemId: string
  testItemName: string
  value: number
  unit: string
  passed: boolean
  deviation: number
  testedAt: string
  testerId: string
  testerName: string
  note?: string
}

export interface CreateEquipmentQcRecordInput {
  deviceId: string
  deviceName?: string
  modality: EquipmentModality
  testItemId: string
  value: number
  testedAt?: string
  testerId?: string
  testerName?: string
  note?: string
}

export interface EquipmentQcScheduleEntry {
  modality: EquipmentModality
  frequency: QcFrequency
  itemCount: number
  deviceCount: number
  items: Array<{ id: string; name: string; standard: string; threshold: string }>
}

export interface EquipmentQcStats {
  total: number
  passed: number
  failed: number
  passRate: number
  byModality: Array<{ modality: EquipmentModality; total: number; passed: number; failed: number; passRate: number }>
  byFrequency: Array<{ frequency: QcFrequency; total: number; passed: number; failed: number; passRate: number }>
  recentFailureCount: number
}

export function thresholdText(t: ThresholdRule): string {
  if (t.op === 'lte') return `≤ ${t.limit} ${t.unit}`
  if (t.op === 'gte') return `≥ ${t.limit} ${t.unit}`
  return `${t.limit} ~ ${t.limit2 ?? t.limit} ${t.unit}`
}

export function evaluateThreshold(t: ThresholdRule, value: number): boolean {
  if (t.op === 'lte') return value <= t.limit
  if (t.op === 'gte') return value >= t.limit
  const lo = Math.min(t.limit, t.limit2 ?? t.limit)
  const hi = Math.max(t.limit, t.limit2 ?? t.limit)
  return value >= lo && value <= hi
}
